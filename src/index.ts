export { CacheLayer } from "./cache-layer";
export { MemoryCacheAdapter } from "./memory-adapter";
export { RedisCacheAdapter } from "./redis-adapter";
export type {
  CacheAdapter,
  CacheEntry,
  CacheLayerOptions,
  CacheStats,
  RequestCacheOptions,
  TtlFunction,
} from "./types";

export function createAxiosInterceptor(cacheLayer: import("./cache-layer").CacheLayer) {
  return {
    request: {
      onFulfilled: (config: Record<string, unknown>) => config,
    },
    response: {
      onFulfilled: async (response: {
        config: { method?: string; url?: string; cacheOptions?: import("./types").RequestCacheOptions };
        status: number;
        data: unknown;
      }) => {
        const method = (response.config.method ?? "get").toUpperCase();
        if (method !== "GET") return response;

        const key = `axios:${response.config.url ?? ""}`;
        const opts = response.config.cacheOptions ?? {};
        await cacheLayer.set(key, response.data, opts);

        return response;
      },
    },
  };
}
