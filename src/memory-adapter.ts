import { CacheAdapter, CacheEntry } from "./types";

export class MemoryCacheAdapter implements CacheAdapter {
  private store: Map<string, CacheEntry> = new Map();
  private readonly maxEntries: number;

  constructor(maxEntries: number = 500) {
    this.maxEntries = maxEntries;
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry;
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      this.evictOldest();
    }
    this.store.set(key, entry as CacheEntry);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async keys(): Promise<string[]> {
    const now = Date.now();
    const validKeys: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      if (now <= entry.expiresAt) {
        validKeys.push(key);
      } else {
        this.store.delete(key);
      }
    }

    return validKeys;
  }

  size(): number {
    return this.store.size;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.store.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }
}
