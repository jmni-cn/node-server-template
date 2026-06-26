import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { RedisService } from './redis.service';
import { buildKey } from './cache-key.builder';
import {
  CACHE_NULL_SENTINEL,
  CACHE_NULL_TTL_SECONDS,
  CACHE_TTL_JITTER_RATIO,
} from './cache.constants';

/** 分布式锁的命名空间前缀。 */
const LOCK_NAMESPACE = 'lock';

/** 锁默认持有时长（秒）。 */
const DEFAULT_LOCK_TTL_SECONDS = 30;

/** `set` 的可选行为（防雪崩抖动开关）。 */
export interface CacheSetOptions {
  /** 命名空间（key 自动加前缀）。 */
  namespace?: string;
  /**
   * 是否在 TTL 上叠加随机抖动（防雪崩）。默认 true。
   * 仅当传入了正数 TTL 时生效；不传 TTL（永不过期）时无影响。
   */
  jitter?: boolean;
}

/** `getOrSet` 的可选行为。 */
export interface GetOrSetOptions {
  /** 命名空间（key 自动加前缀）。 */
  namespace?: string;
  /**
   * 是否启用空值缓存防穿透。默认 true。
   * factory 返回 null/undefined 时写入短 TTL 空值占位，后续命中占位直接返回 null。
   */
  cacheNull?: boolean;
  /** 空值占位 TTL（秒）。默认 {@link CACHE_NULL_TTL_SECONDS}。 */
  nullTtlSeconds?: number;
  /** 是否对正常值的 TTL 叠加抖动（防雪崩）。默认 true。 */
  jitter?: boolean;
}

/** 持有的锁句柄（释放时用 token 做 CAS 校验，防误删他人锁）。 */
export interface AcquiredLock {
  /** 业务锁名（不含命名空间前缀）。 */
  name: string;
  /** 锁持有令牌（释放时 CAS 校验）。 */
  token: string;
}

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
   *
   * 注意：命中「空值占位」（防穿透哨兵）时返回 null，与「真正未命中」无法区分。
   * 需要区分二者的场景，请改用 {@link getOrSet}（内部按原始值判断占位）。
   */
  async get<T>(key: string, namespace?: string): Promise<T | null> {
    const raw = await this.redis.get(this.resolveKey(key, namespace));
    if (raw === null) return null;
    if (raw === CACHE_NULL_SENTINEL) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /**
   * 序列化并写入，可选 TTL（秒）与命名空间。
   *
   * 当传入正数 TTL 时，默认叠加 ±{@link CACHE_TTL_JITTER_RATIO} 的随机抖动（防雪崩），
   * 打散大量同时写入的 key 的过期时刻。不传 TTL（永不过期）时不受影响。
   * 需要精确 TTL（如对齐固定窗口）时，传入 `options.jitter = false` 关闭抖动。
   *
   * 兼容旧签名：第 4 个参数可直接传 namespace 字符串，也可传 {@link CacheSetOptions}。
   */
  async set<T>(
    key: string,
    value: T,
    ttlSeconds?: number,
    namespaceOrOptions?: string | CacheSetOptions,
  ): Promise<void> {
    const { namespace, jitter } = this.normalizeSetOptions(namespaceOrOptions);
    const effectiveTtl = this.applyJitter(ttlSeconds, jitter);
    await this.redis.set(
      this.resolveKey(key, namespace),
      JSON.stringify(value),
      effectiveTtl,
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
   *
   * 防穿透：当 factory 返回 null/undefined 时，写入一个**短 TTL 的空值占位**
   * （哨兵），后续在占位 TTL 内命中即直接返回 null，避免热点不存在的 key 反复
   * 击穿到 DB。可通过 `options.cacheNull = false` 关闭。
   *
   * 防雪崩：正常值默认对 TTL 叠加随机抖动（见 {@link set}）。
   *
   * 兼容旧签名：第 4 个参数可直接传 namespace 字符串，也可传 {@link GetOrSetOptions}。
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number,
    namespaceOrOptions?: string | GetOrSetOptions,
  ): Promise<T> {
    const {
      namespace,
      cacheNull = true,
      nullTtlSeconds = CACHE_NULL_TTL_SECONDS,
      jitter = true,
    } = this.normalizeGetOrSetOptions(namespaceOrOptions);

    // 读原始值以区分「命中空值占位」与「真正未命中」。
    const raw = await this.redis.get(this.resolveKey(key, namespace));
    if (raw === CACHE_NULL_SENTINEL) {
      // 命中防穿透占位：已知不存在，直接返回 null（不回源）。
      return null as T;
    }
    if (raw !== null) {
      try {
        return JSON.parse(raw) as T;
      } catch {
        // 解析失败按未命中处理，继续回源。
      }
    }

    const value = await factory();

    if (value === null || value === undefined) {
      if (cacheNull) {
        // 写入空值占位（短 TTL，不加抖动以保持可预期的快速回源）。
        await this.redis.set(
          this.resolveKey(key, namespace),
          CACHE_NULL_SENTINEL,
          nullTtlSeconds,
        );
      }
      return value as T;
    }

    await this.set(key, value, ttlSeconds, { namespace, jitter });
    return value;
  }

  /**
   * 获取分布式锁（SET NX EX）。成功返回锁句柄；已被占用返回 null（不阻塞）。
   *
   * @param name       业务锁名（自动加 `lock:` 命名空间前缀）。
   * @param ttlSeconds 锁自动过期时长（秒），防持有者崩溃导致死锁。默认 30s。
   */
  async acquireLock(
    name: string,
    ttlSeconds = DEFAULT_LOCK_TTL_SECONDS,
  ): Promise<AcquiredLock | null> {
    const token = randomBytes(16).toString('hex');
    const ok = await this.redis.setNX(
      this.resolveKey(name, LOCK_NAMESPACE),
      token,
      ttlSeconds,
    );
    return ok ? { name, token } : null;
  }

  /**
   * 释放分布式锁（token-CAS）：仅当锁值仍等于持有 token 时删除，防止误删他人锁。
   * 返回 true 表示成功释放；false 表示锁已过期或被他人持有。
   */
  async releaseLock(lock: AcquiredLock): Promise<boolean> {
    return this.redis.releaseByToken(
      this.resolveKey(lock.name, LOCK_NAMESPACE),
      lock.token,
    );
  }

  /**
   * 在分布式锁保护下执行 fn：获取失败抛错（由调用方处理重试/降级），
   * 无论 fn 成功或抛出都会在 finally 中以 CAS 释放锁。
   *
   * @returns fn 的返回值。
   * @throws 当锁被占用（获取失败）时抛出 Error('lock busy: <name>')。
   */
  async withLock<T>(
    name: string,
    fn: () => Promise<T>,
    ttlSeconds = DEFAULT_LOCK_TTL_SECONDS,
  ): Promise<T> {
    const lock = await this.acquireLock(name, ttlSeconds);
    if (!lock) {
      throw new Error(`lock busy: ${name}`);
    }
    try {
      return await fn();
    } finally {
      await this.releaseLock(lock);
    }
  }

  /**
   * 在基准 TTL 上叠加 ±{@link CACHE_TTL_JITTER_RATIO} 的随机抖动（防雪崩）。
   *
   * - 仅当 TTL 为正数且 `enabled` 为 true 时生效；
   * - 抖动后至少为 1 秒，避免向下取整为 0 导致「不过期」。
   */
  private applyJitter(
    ttlSeconds: number | undefined,
    enabled: boolean,
  ): number | undefined {
    if (!enabled || ttlSeconds === undefined || ttlSeconds <= 0) {
      return ttlSeconds;
    }
    // factor ∈ [1 - ratio, 1 + ratio)
    const factor = 1 + (Math.random() * 2 - 1) * CACHE_TTL_JITTER_RATIO;
    return Math.max(1, Math.round(ttlSeconds * factor));
  }

  /** 归一化 set 的第 4 参数（兼容旧的 namespace 字符串）。 */
  private normalizeSetOptions(
    namespaceOrOptions?: string | CacheSetOptions,
  ): { namespace?: string; jitter: boolean } {
    if (typeof namespaceOrOptions === 'string') {
      return { namespace: namespaceOrOptions, jitter: true };
    }
    return {
      namespace: namespaceOrOptions?.namespace,
      jitter: namespaceOrOptions?.jitter ?? true,
    };
  }

  /** 归一化 getOrSet 的第 4 参数（兼容旧的 namespace 字符串）。 */
  private normalizeGetOrSetOptions(
    namespaceOrOptions?: string | GetOrSetOptions,
  ): GetOrSetOptions {
    if (typeof namespaceOrOptions === 'string') {
      return { namespace: namespaceOrOptions };
    }
    return namespaceOrOptions ?? {};
  }

  private resolveKey(key: string, namespace?: string): string {
    return namespace ? buildKey(namespace, key) : key;
  }
}
