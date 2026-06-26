import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './cache.constants';

/** 原子 GET+DEL（GETDEL 兜底，Redis < 6.2）。 */
const GET_DEL_LUA = `
local v = redis.call('GET', KEYS[1])
if v then redis.call('DEL', KEYS[1]) end
return v
`;

/** token-CAS 释放锁：值匹配才删除，返回 1 表示已删除，0 表示未匹配。 */
const RELEASE_LOCK_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
`;

/**
 * 固定窗口限流：INCR + 首次 EXPIRE（原子），返回 {count, ttl}。
 * 单脚本完成自增与首次设置过期，杜绝 INCR 后 EXPIRE 之间崩溃导致 key 永不过期。
 * ARGV[1]=windowSeconds。
 */
const RATE_LIMIT_LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {count, ttl}
`;

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
   * 若 ioredis/服务端不支持 `getdel`，回退为 Lua 脚本 `GET + DEL`（**仍保证原子**，
   * 单次往返不可被打断），不再退化为非原子 get-then-del。一次性令牌（如 SSO 一次性
   * 登录码 / one-time code）防重放依赖该原子性。返回被删除前的值；不存在返回 null。
   */
  async getDel(key: string): Promise<string | null> {
    const client = this.redis as Redis & {
      getdel?: (key: string) => Promise<string | null>;
    };
    if (typeof client.getdel === 'function') {
      return client.getdel(key);
    }
    // Lua 原子 GET+DEL 兜底（旧 Redis < 6.2 无 GETDEL）。
    const result = (await this.redis.eval(GET_DEL_LUA, 1, key)) as string | null;
    return result;
  }

  /**
   * 仅当 key 不存在时设置（SET NX），可选 TTL（秒）。
   *
   * 返回 true 表示设置成功（key 此前不存在）；false 表示 key 已存在未覆盖。
   * 用于分布式锁、一次性占位等需要「占坑」语义的场景。
   */
  async setNX(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    const res =
      ttlSeconds && ttlSeconds > 0
        ? await this.redis.set(key, value, 'EX', ttlSeconds, 'NX')
        : await this.redis.set(key, value, 'NX');
    return res === 'OK';
  }

  /**
   * 以 token-CAS 方式释放锁：仅当 key 的当前值等于 token 时才删除，防止误删他人锁。
   *
   * 返回 true 表示成功释放（值匹配并删除）；false 表示锁已不属于该 token（已过期/被他人持有）。
   */
  async releaseByToken(key: string, token: string): Promise<boolean> {
    const res = (await this.redis.eval(
      RELEASE_LOCK_LUA,
      1,
      key,
      token,
    )) as number;
    return res === 1;
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

  /**
   * 原子固定窗口限流命中：单脚本完成 INCR + 首次 EXPIRE + 读 TTL。
   *
   * 返回 `[count, ttl]`：count 为当前窗口内累计命中次数；ttl 为剩余存活秒数
   * （正常 > 0）。避免 INCR 与 EXPIRE 分两步时的竞态（崩溃导致 key 永不过期）。
   */
  async rateLimitHit(
    key: string,
    windowSeconds: number,
  ): Promise<{ count: number; ttl: number }> {
    const res = (await this.redis.eval(
      RATE_LIMIT_LUA,
      1,
      key,
      String(windowSeconds),
    )) as [number, number];
    return { count: res[0], ttl: res[1] };
  }

  /** PING 健康检查，正常返回 'PONG'。 */
  async ping(): Promise<string> {
    return this.redis.ping();
  }
}
