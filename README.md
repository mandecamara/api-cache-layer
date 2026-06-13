# api-cache-layer

Intelligent caching layer for API calls. Supports in-memory and Redis backends, dynamic TTL, tag-based invalidation, and Axios/Fetch integration.

## Installation

```bash
npm install api-cache-layer
# Optional: Redis support
npm install ioredis
```

## Features

- Memory cache with LRU eviction
- Redis adapter for distributed caching
- Dynamic TTL per response
- Tag-based invalidation
- Pattern-based invalidation
- Axios interceptor integration
- Fetch wrapper
- Hit/miss statistics and callbacks
- Full TypeScript support

## Quick Start

```typescript
import { CacheLayer } from "api-cache-layer";

const cache = new CacheLayer({
  defaultTtl: 60000,
  maxMemoryEntries: 1000,
  keyPrefix: "myapp",
  onHit: (key) => { /* analytics */ },
  onMiss: (key) => { /* analytics */ },
});

const data = await cache.wrap("users:list", async () => {
  const response = await fetch("https://api.example.com/users");
  return response.json();
}, { ttl: 30000, tags: ["users"] });
```

## Adapters

### Memory (default)

```typescript
import { CacheLayer, MemoryCacheAdapter } from "api-cache-layer";

const cache = new CacheLayer({
  adapter: new MemoryCacheAdapter(500),
  defaultTtl: 60000,
});
```

### Redis

```typescript
import Redis from "ioredis";
import { CacheLayer, RedisCacheAdapter } from "api-cache-layer";

const redis = new Redis({ host: "localhost", port: 6379 });

const cache = new CacheLayer({
  adapter: new RedisCacheAdapter(redis, "myapp:cache:"),
  defaultTtl: 300000,
});
```

## API

### `cache.wrap(key, fetcher, options?)`

Fetch with caching. Calls fetcher only on cache miss.

```typescript
const user = await cache.wrap(
  `user:${id}`,
  () => fetchUser(id),
  {
    ttl: 30000,
    tags: ["users", `user:${id}`],
  }
);
```

### `cache.set(key, value, options?)`

Store a value manually.

```typescript
await cache.set("config", appConfig, { ttl: 3600000 });
```

### `cache.get(key)`

Retrieve a cached value or null.

```typescript
const config = await cache.get<AppConfig>("config");
```

### `cache.invalidate(key)`

Remove a single cache entry.

```typescript
await cache.invalidate("user:42");
```

### `cache.invalidateByTag(tag)`

Remove all entries with a given tag.

```typescript
// After updating a user, invalidate all cached data tagged with their ID
await cache.invalidateByTag("user:42");
```

### `cache.invalidateByPattern(pattern)`

Remove all entries matching a regex pattern.

```typescript
await cache.invalidateByPattern("^users:");
```

### `cache.clear()`

Remove all cached entries and reset stats.

### `cache.getStats()`

```typescript
const { hits, misses, hitRate } = cache.getStats();
```

### Dynamic TTL

```typescript
const cache = new CacheLayer({
  ttlByStatus: {
    200: 60000,
    404: 5000,
    500: 0,
  },
});

// Or per-request function
await cache.wrap("key", fetcher, {
  ttl: (response) => response.isStale ? 5000 : 60000,
});
```

## Axios Integration

```typescript
import axios from "axios";
import { CacheLayer, createAxiosInterceptor } from "api-cache-layer";

const cache = new CacheLayer();
const interceptor = createAxiosInterceptor(cache);

axios.interceptors.response.use(interceptor.response.onFulfilled);
```

## Fetch Wrapper

```typescript
const cachedFetch = cache.wrapFetch("https://api.example.com");

const response = await cachedFetch("/users");
const data = await response.json();
```

## Running Tests

```bash
npm install
npm test
```

## License

MIT
