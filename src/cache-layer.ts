import {
  CacheAdapter,
  CacheLayerOptions,
  CacheStats,
  RequestCacheOptions,
  TtlFunction,
} from "./types";
import { MemoryCacheAdapter } from "./memory-adapter";

const DEFAULT_TTL = 60000;

export class CacheLayer {
  private adapter: CacheAdapter;
  private options: Required<Omit<CacheLayerOptions, "adapter" | "onHit" | "onMiss">> &
    Pick<CacheLayerOptions, "onHit" | "onMiss">;
  private stats = { hits: 0, misses: 0 };

  constructor(options: CacheLayerOptions = {}) {
    this.adapter = options.adapter ?? new MemoryCacheAdapter(options.maxMemoryEntries);
    this.options = {
      defaultTtl: options.defaultTtl ?? DEFAULT_TTL,
      maxMemoryEntries: options.maxMemoryEntries ?? 500,
      keyPrefix: options.keyPrefix ?? "",
      ttlByStatus: options.ttlByStatus ?? {},
      onHit: options.onHit,
      onMiss: options.onMiss,
    };
  }

  async wrap<T>(
    key: string,
    fetcher: () => Promise<T>,
    cacheOptions: RequestCacheOptions = {}
  ): Promise<T> {
    const fullKey = this.buildKey(key, cacheOptions.key);

    if (!cacheOptions.bypass) {
      const cached = await this.adapter.get<T>(fullKey);
      if (cached !== null) {
        this.stats.hits++;
        this.options.onHit?.(fullKey);
        return cached.value;
      }
    }

    this.stats.misses++;
    this.options.onMiss?.(fullKey);

    const value = await fetcher();
    const ttl = this.resolveTtl(value, cacheOptions.ttl);

    await this.adapter.set<T>(fullKey, {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
      tags: cacheOptions.tags,
    });

    return value;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = await this.adapter.get<T>(this.buildKey(key));
    if (!entry) return null;
    return entry.value;
  }

  async set<T>(key: string, value: T, options: RequestCacheOptions = {}): Promise<void> {
    const ttl = this.resolveTtl(value, options.ttl);
    await this.adapter.set<T>(this.buildKey(key), {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
      tags: options.tags,
    });
  }

  async invalidate(key: string): Promise<void> {
    await this.adapter.delete(this.buildKey(key));
  }

  async invalidateByTag(tag: string): Promise<void> {
    const allKeys = await this.adapter.keys();
    const deletions: Promise<void>[] = [];

    for (const key of allKeys) {
      const entry = await this.adapter.get(key);
      if (entry?.tags?.includes(tag)) {
        deletions.push(this.adapter.delete(key));
      }
    }

    await Promise.all(deletions);
  }

  async invalidateByPattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    const allKeys = await this.adapter.keys();
    const deletions = allKeys
      .filter((k) => regex.test(k))
      .map((k) => this.adapter.delete(k));
    await Promise.all(deletions);
  }

  async clear(): Promise<void> {
    await this.adapter.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: 0,
      hitRate: total === 0 ? 0 : this.stats.hits / total,
    };
  }

  wrapFetch(baseUrl?: string): typeof fetch {
    const self = this;
    return async function cachedFetch(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const method = init?.method?.toUpperCase() ?? "GET";
      if (method !== "GET") {
        return fetch(input, init);
      }

      const url = typeof input === "string" ? input : input.toString();
      const fullUrl = baseUrl ? `${baseUrl}${url}` : url;

      const cacheKey = `fetch:${fullUrl}`;
      const cached = await self.adapter.get<{ body: string; status: number; headers: Record<string, string> }>(cacheKey);

      if (cached) {
        self.stats.hits++;
        return new Response(cached.value.body, {
          status: cached.value.status,
          headers: cached.value.headers,
        });
      }

      self.stats.misses++;
      const response = await fetch(input, init);
      const body = await response.text();
      const ttl = self.options.ttlByStatus[response.status] ?? self.options.defaultTtl;

      if (response.ok) {
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => { headers[key] = value; });

        await self.adapter.set(cacheKey, {
          value: { body, status: response.status, headers },
          expiresAt: Date.now() + ttl,
          createdAt: Date.now(),
        });
      }

      return new Response(body, {
        status: response.status,
        headers: response.headers,
      });
    };
  }

  private buildKey(key: string, override?: string): string {
    const base = override ?? key;
    return this.options.keyPrefix ? `${this.options.keyPrefix}:${base}` : base;
  }

  private resolveTtl<T>(value: T, ttl?: number | TtlFunction<T>): number {
    if (typeof ttl === "function") return ttl(value);
    if (typeof ttl === "number") return ttl;
    return this.options.defaultTtl;
  }
}
