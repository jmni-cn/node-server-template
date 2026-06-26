import { Injectable } from '@nestjs/common';
import { RedisService } from '@platform/cache';

const KEY_PREFIX = 'security:ratelimit:';

export interface RateLimitResult {
  /** Whether the current hit is within the configured limit. */
  allowed: boolean;
  /** Remaining requests in the current window (never negative). */
  remaining: number;
  /** Seconds until the current window resets. */
  resetInSeconds: number;
}

/**
 * Fixed-window rate limiter backed by Redis INCR + EXPIRE.
 */
@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  /**
   * Register a hit against the given key.
   *
   * @param key        Logical identity to limit (e.g. ip, ip:path, user).
   * @param windowMs   Window size in milliseconds.
   * @param max        Maximum allowed hits per window.
   */
  async hit(
    key: string,
    windowMs: number,
    max: number,
  ): Promise<RateLimitResult> {
    const redisKey = `${KEY_PREFIX}${key}`;
    const windowSeconds = Math.ceil(windowMs / 1000);

    // 原子 INCR + 首次 EXPIRE + 读 TTL（单 Lua 脚本），消除分步竞态导致 key 永不过期。
    const { count, ttl } = await this.redis.rateLimitHit(redisKey, windowSeconds);
    const resetInSeconds = ttl > 0 ? ttl : windowSeconds;
    const remaining = Math.max(0, max - count);
    const allowed = count <= max;

    return { allowed, remaining, resetInSeconds };
  }
}
