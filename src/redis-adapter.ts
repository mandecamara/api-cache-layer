import { CacheAdapter, CacheEntry } from "./types";

export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiryMode: string, time: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
  flushdb(): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
}

export class RedisCacheAdapter implements CacheAdapter {
  private client: RedisClient;
  private keyPrefix: string;

  constructor(client: RedisClient, keyPrefix: string = "cache:") {
    this.client = client;
    this.keyPrefix = keyPrefix;
  }

  private fullKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const raw = await this.client.get(this.fullKey(key));
    if (!raw) return null;

    try {
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (Date.now() > entry.expiresAt) {
        await this.delete(key);
        return null;
      }
      return entry;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const ttlSeconds = Math.ceil((entry.expiresAt - Date.now()) / 1000);
    if (ttlSeconds <= 0) return;

    await this.client.set(
      this.fullKey(key),
      JSON.stringify(entry),
      "EX",
      ttlSeconds
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.del(this.fullKey(key));
  }

  async clear(): Promise<void> {
    await this.client.flushdb();
  }

  async keys(): Promise<string[]> {
    const prefixedKeys = await this.client.keys(`${this.keyPrefix}*`);
    return prefixedKeys.map((k) => k.slice(this.keyPrefix.length));
  }
}
