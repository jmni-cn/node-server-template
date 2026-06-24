import { Injectable } from '@nestjs/common';
import { RedisService } from '@platform/cache';
import { normalizeIp } from './ip.util';

const KEY_PREFIX = 'security:ip:ban:';
const DEFAULT_TTL_SECONDS = 86_400;

interface BanRecord {
  reason: string;
  bannedAt: string;
}

/**
 * Redis-backed IP blacklist with TTL-based expiry.
 */
@Injectable()
export class IpBlacklistService {
  constructor(private readonly redis: RedisService) {}

  /** Block an IP for the given duration (default 24h). */
  async block(
    ip: string,
    reason: string,
    ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const record: BanRecord = {
      reason,
      bannedAt: new Date().toISOString(),
    };
    await this.redis.set(this.key(ip), JSON.stringify(record), ttlSeconds);
  }

  /** Remove an IP from the blacklist. */
  async unblock(ip: string): Promise<void> {
    await this.redis.del(this.key(ip));
  }

  /** Whether the IP is currently blacklisted. */
  async isBlocked(ip: string): Promise<boolean> {
    return this.redis.exists(this.key(ip));
  }

  /** Remaining ban time in seconds (negative when not set / no expiry). */
  async ttl(ip: string): Promise<number> {
    return this.redis.ttl(this.key(ip));
  }

  private key(ip: string): string {
    return `${KEY_PREFIX}${normalizeIp(ip)}`;
  }
}
