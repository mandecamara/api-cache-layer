import { CacheLayer } from "../src/cache-layer";
import { MemoryCacheAdapter } from "../src/memory-adapter";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("MemoryCacheAdapter", () => {
  let adapter: MemoryCacheAdapter;

  beforeEach(() => {
    adapter = new MemoryCacheAdapter(3);
  });

  it("stores and retrieves a value", async () => {
    await adapter.set("key1", { value: "hello", expiresAt: Date.now() + 10000, createdAt: Date.now() });
    const result = await adapter.get("key1");
    expect(result?.value).toBe("hello");
  });

  it("returns null for expired entry", async () => {
    await adapter.set("key1", { value: "hello", expiresAt: Date.now() - 1, createdAt: Date.now() });
    const result = await adapter.get("key1");
    expect(result).toBeNull();
  });

  it("deletes an entry", async () => {
    await adapter.set("key1", { value: "hello", expiresAt: Date.now() + 10000, createdAt: Date.now() });
    await adapter.delete("key1");
    const result = await adapter.get("key1");
    expect(result).toBeNull();
  });

  it("clears all entries", async () => {
    await adapter.set("k1", { value: 1, expiresAt: Date.now() + 10000, createdAt: Date.now() });
    await adapter.set("k2", { value: 2, expiresAt: Date.now() + 10000, createdAt: Date.now() });
    await adapter.clear();
    expect(await adapter.keys()).toHaveLength(0);
  });

  it("evicts oldest entry when full", async () => {
    const old = Date.now() - 5000;
    await adapter.set("old", { value: "old", expiresAt: Date.now() + 10000, createdAt: old });
    await adapter.set("new1", { value: "n1", expiresAt: Date.now() + 10000, createdAt: Date.now() });
    await adapter.set("new2", { value: "n2", expiresAt: Date.now() + 10000, createdAt: Date.now() });
    await adapter.set("new3", { value: "n3", expiresAt: Date.now() + 10000, createdAt: Date.now() });
    const result = await adapter.get("old");
    expect(result).toBeNull();
  });
});

describe("CacheLayer", () => {
  let cache: CacheLayer;

  beforeEach(() => {
    cache = new CacheLayer({ defaultTtl: 5000 });
  });

  afterEach(async () => {
    await cache.clear();
  });

  it("wraps fetcher and caches result", async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { data: "result" };
    };

    const result1 = await cache.wrap("key", fetcher);
    const result2 = await cache.wrap("key", fetcher);

    expect(result1).toEqual({ data: "result" });
    expect(result2).toEqual({ data: "result" });
    expect(callCount).toBe(1);
  });

  it("bypasses cache when bypass option is set", async () => {
    let callCount = 0;
    const fetcher = async () => { callCount++; return "value"; };

    await cache.wrap("key", fetcher);
    await cache.wrap("key", fetcher, { bypass: true });

    expect(callCount).toBe(2);
  });

  it("invalidates a specific key", async () => {
    let callCount = 0;
    const fetcher = async () => { callCount++; return "v"; };

    await cache.wrap("key", fetcher);
    await cache.invalidate("key");
    await cache.wrap("key", fetcher);

    expect(callCount).toBe(2);
  });

  it("invalidates by tag", async () => {
    let callCount = 0;
    const fetcher = async () => { callCount++; return "v"; };

    await cache.wrap("key1", fetcher, { tags: ["user:1"] });
    await cache.wrap("key2", fetcher, { tags: ["user:1"] });
    await cache.wrap("key3", fetcher, { tags: ["user:2"] });

    await cache.invalidateByTag("user:1");

    await cache.wrap("key1", fetcher);
    await cache.wrap("key2", fetcher);
    await cache.wrap("key3", fetcher);

    expect(callCount).toBe(5);
  });

  it("invalidates by pattern", async () => {
    let callCount = 0;
    const fetcher = async () => { callCount++; return "v"; };

    await cache.wrap("users:1", fetcher);
    await cache.wrap("users:2", fetcher);
    await cache.wrap("posts:1", fetcher);

    await cache.invalidateByPattern("^users:");

    await cache.wrap("users:1", fetcher);
    await cache.wrap("users:2", fetcher);
    await cache.wrap("posts:1", fetcher);

    expect(callCount).toBe(5);
  });

  it("uses dynamic TTL from function", async () => {
    const dynamicTtl = (val: string) => (val === "short" ? 10 : 10000);
    let callCount = 0;

    const fetcher = async () => { callCount++; return "short"; };
    await cache.wrap("key", fetcher, { ttl: dynamicTtl });

    await sleep(50);
    await cache.wrap("key", fetcher, { ttl: dynamicTtl });

    expect(callCount).toBe(2);
  });

  it("tracks hit rate stats", async () => {
    const fetcher = async () => "value";
    await cache.wrap("key", fetcher);
    await cache.wrap("key", fetcher);
    await cache.wrap("key", fetcher);

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.667, 2);
  });

  it("calls onHit and onMiss callbacks", async () => {
    const onHit = jest.fn();
    const onMiss = jest.fn();
    const localCache = new CacheLayer({ onHit, onMiss });

    const fetcher = async () => "value";
    await localCache.wrap("key", fetcher);
    await localCache.wrap("key", fetcher);

    expect(onMiss).toHaveBeenCalledTimes(1);
    expect(onHit).toHaveBeenCalledTimes(1);
    await localCache.clear();
  });

  it("sets and gets values directly", async () => {
    await cache.set("direct", { foo: "bar" });
    const result = await cache.get("direct");
    expect(result).toEqual({ foo: "bar" });
  });

  it("applies key prefix when configured", async () => {
    const prefixed = new CacheLayer({ keyPrefix: "myapp" });
    let callCount = 0;
    const fetcher = async () => { callCount++; return "v"; };
    await prefixed.wrap("key", fetcher);
    await prefixed.wrap("key", fetcher);
    expect(callCount).toBe(1);
    await prefixed.clear();
  });
});
