import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { buildKey } from './cache-key.builder';

/**
 * CacheService — 在 RedisService 之上提供类型化的 JSON 缓存。
 *
 * - 值以 JSON 序列化存储；
 * - 支持 TTL（秒）；
 * - 支持可选命名空间（key 自动加前缀）。
 */
@Injectable()
export class CacheService {
  constructor(private readonly redis: RedisService) {}

  /**
   * 读取并反序列化为目标类型，不存在/解析失败返回 null。
   */
  async get<T>(key: string, namespace?: string): Promise<T | null> {
    const raw = await this.redis.get(this.resolveKey(key, namespace));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /**
   * 序列化并写入，可选 TTL（秒）与命名空间。
   */
  async set<T>(
    key: string,
    value: T,
    ttlSeconds?: number,
    namespace?: string,
  ): Promise<void> {
    await this.redis.set(
      this.resolveKey(key, namespace),
      JSON.stringify(value),
      ttlSeconds,
    );
  }

  /** 删除键。 */
  async del(key: string, namespace?: string): Promise<number> {
    return this.redis.del(this.resolveKey(key, namespace));
  }

  /**
   * 原子地读取并删除（GETDEL）：返回被删除前反序列化的值，不存在/解析失败返回 null。
   *
   * 适用于一次性令牌（如 SSO 一次性登录码）：读取即失效，避免重放。
   */
  async getAndDel<T>(key: string, namespace?: string): Promise<T | null> {
    const raw = await this.redis.getDel(this.resolveKey(key, namespace));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /** 设置过期时间（秒）。 */
  async expire(
    key: string,
    ttlSeconds: number,
    namespace?: string,
  ): Promise<boolean> {
    return this.redis.expire(this.resolveKey(key, namespace), ttlSeconds);
  }

  /** 自增计数。 */
  async incr(key: string, namespace?: string): Promise<number> {
    return this.redis.incr(this.resolveKey(key, namespace));
  }

  /** 剩余 TTL（秒）。 */
  async ttl(key: string, namespace?: string): Promise<number> {
    return this.redis.ttl(this.resolveKey(key, namespace));
  }

  /** key 是否存在。 */
  async has(key: string, namespace?: string): Promise<boolean> {
    return this.redis.exists(this.resolveKey(key, namespace));
  }

  /**
   * 读穿（read-through）：命中返回缓存值，否则执行 factory 并回填。
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number,
    namespace?: string,
  ): Promise<T> {
    const cached = await this.get<T>(key, namespace);
    if (cached !== null) return cached;
    const value = await factory();
    await this.set(key, value, ttlSeconds, namespace);
    return value;
  }

  private resolveKey(key: string, namespace?: string): string {
    return namespace ? buildKey(namespace, key) : key;
  }
}
