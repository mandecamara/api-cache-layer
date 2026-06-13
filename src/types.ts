export interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
  createdAt: number;
  tags?: string[];
}

export interface CacheAdapter {
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

export interface TtlFunction<T = unknown> {
  (response: T): number;
}

export interface CacheLayerOptions {
  adapter?: CacheAdapter;
  defaultTtl?: number;
  maxMemoryEntries?: number;
  keyPrefix?: string;
  ttlByStatus?: Record<number, number>;
  onHit?: (key: string) => void;
  onMiss?: (key: string) => void;
}

export interface RequestCacheOptions {
  ttl?: number | TtlFunction;
  tags?: string[];
  bypass?: boolean;
  key?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}
