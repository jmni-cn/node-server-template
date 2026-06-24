/**
 * @platform/cache — Redis 缓存基础设施。
 *
 * 提供全局 CacheModule（ioredis 单例）、RedisService（薄封装）、
 * CacheService（JSON + TTL + namespace 类型化缓存）与 cache-key 构造器。
 */
export * from './cache.constants';
export * from './cache-key.builder';
export * from './redis.service';
export * from './cache.service';
export * from './cache.module';
