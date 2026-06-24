import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './cache.constants';

/**
 * RedisService — ioredis 的薄封装。
 *
 * 暴露最常用的字符串/计数/过期原语；需要更底层能力时可通过 `client` 直接访问。
 */
@Injectable()
export class RedisService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** 暴露原始 ioredis 客户端（高级用法）。 */
  get client(): Redis {
    return this.redis;
  }

  /** 获取字符串值（不存在返回 null）。 */
  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  /**
   * 设置字符串值，可选 TTL（秒）。
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.redis.set(key, value);
    }
  }

  /** 删除一个或多个 key，返回删除数量。 */
  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.redis.del(...keys);
  }

  /**
   * 原子地读取并删除一个 key（GETDEL，Redis 6.2+）。
   *
   * 若 ioredis 不支持 `getdel`（旧服务端/旧客户端），回退为 get-then-del（非原子，
   * 但一次性令牌场景下足够）。返回被删除前的值；不存在返回 null。
   */
  async getDel(key: string): Promise<string | null> {
    const client = this.redis as Redis & {
      getdel?: (key: string) => Promise<string | null>;
    };
    if (typeof client.getdel === 'function') {
      return client.getdel(key);
    }
    const value = await this.redis.get(key);
    if (value !== null) {
      await this.redis.del(key);
    }
    return value;
  }

  /** 设置过期时间（秒）。 */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const res = await this.redis.expire(key, ttlSeconds);
    return res === 1;
  }

  /** 自增计数（key 不存在则从 0 开始）。 */
  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  /** 按步长自增。 */
  async incrBy(key: string, increment: number): Promise<number> {
    return this.redis.incrby(key, increment);
  }

  /** 剩余存活时间（秒）。-2 不存在，-1 无过期。 */
  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  /** key 是否存在。 */
  async exists(key: string): Promise<boolean> {
    const res = await this.redis.exists(key);
    return res === 1;
  }

  /** PING 健康检查，正常返回 'PONG'。 */
  async ping(): Promise<string> {
    return this.redis.ping();
  }
}
