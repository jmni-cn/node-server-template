# @platform/cache

Redis caching infrastructure for the platform layer.

## Provides

- **`CacheModule`** — `@Global()` module that creates a single shared `ioredis` client from `redisConfig` (`@core/config`). Import once in the app root module.
- **`RedisService`** — thin `ioredis` wrapper: `get / set / del / expire / incr / incrBy / ttl / exists / ping`, plus raw `.client`.
- **`CacheService`** — typed JSON cache over `RedisService`: `get<T> / set<T> / del / expire / incr / ttl / has / getOrSet`, all supporting an optional `namespace`.
- **`buildKey(namespace, ...parts)`** — consistent key builder (`:`-joined).
- **`REDIS_CLIENT`** — DI token for the raw `ioredis` client.

## Usage

```ts
@Module({ imports: [CacheModule] })
export class AppModule {}

constructor(private readonly cache: CacheService) {}

await this.cache.set('profile', user, 300, 'user'); // key => user:profile
const u = await this.cache.get<User>('profile', 'user');
```

## Layer

`@platform/cache` depends only on `@core/config`. Consumed by `@platform/auth`, `@platform/security`, `@platform/health`, and apps.
