import { Injectable } from '@nestjs/common';
import { RuntimeConfigService } from '@platform/config';
import { RedisService } from '@platform/cache';
import { SECURITY_CONFIG_KEYS } from '../constants/config-keys';
import { normalizeIp } from './ip.util';

const KEY_PREFIX = 'security:ip:ban:';
const FAIL_KEY_PREFIX = 'security:ip:fail:';
const DEFAULT_TTL_SECONDS = 86_400;

interface BanRecord {
  reason: string;
  bannedAt: string;
}

/** 可疑活动累计自动封禁的策略选项。 */
export interface SuspiciousActivityOptions {
  /** 滑动窗口（秒）。未传时运行期读 security.ip.suspicious_window_seconds（默认 3600）。 */
  windowSeconds?: number;
  /** 窗口内触发自动封禁的累计阈值。未传时运行期读 security.ip.suspicious_threshold（默认 20）。 */
  threshold?: number;
  /** 触发后封禁时长（秒）。未传时运行期读 security.ip.ban_seconds（默认 3600）。 */
  banSeconds?: number;
}

/** 记录一次可疑活动后的结果。 */
export interface SuspiciousActivityResult {
  /** 当前窗口内的累计次数 */
  count: number;
  /** 本次是否触发了自动封禁 */
  banned: boolean;
}

/**
 * Redis-backed IP blacklist with TTL-based expiry.
 */
@Injectable()
export class IpBlacklistService {
  constructor(
    private readonly redis: RedisService,
    // 运行期配置读取（DB → env → 代码默认，fail-safe，热更新）。
    private readonly runtimeConfig: RuntimeConfigService,
  ) {}

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

  /**
   * 记录一次来自某 IP 的可疑活动（如登录失败），在滑动窗口内累计；
   * 累计达到阈值时自动将该 IP 封禁一段时间。
   *
   * 用于「窗口内累计阈值 → 自动 block」的轻量风控。返回累计次数与是否已封禁。
   */
  async recordSuspiciousActivity(
    ip: string,
    reason: string,
    options?: SuspiciousActivityOptions,
  ): Promise<SuspiciousActivityResult> {
    // 显式 options 优先；否则运行期从 security.ip.* 解析（DB → env → 代码默认）。
    // 不传内联默认：getter 未传 defaultValue 时回退到注册表 def.defaultValue，
    // 默认值仅在 SecurityModule 的定义注册表里出现一处。
    const windowSeconds =
      options?.windowSeconds ??
      (await this.runtimeConfig.getNumber(
        SECURITY_CONFIG_KEYS.IP_SUSPICIOUS_WINDOW_SECONDS,
      ));
    const threshold =
      options?.threshold ??
      (await this.runtimeConfig.getNumber(
        SECURITY_CONFIG_KEYS.IP_SUSPICIOUS_THRESHOLD,
      ));
    const banSeconds =
      options?.banSeconds ??
      (await this.runtimeConfig.getNumber(
        SECURITY_CONFIG_KEYS.IP_BAN_SECONDS,
      ));

    const failKey = `${FAIL_KEY_PREFIX}${normalizeIp(ip)}`;
    const count = await this.redis.incr(failKey);
    if (count === 1) {
      // 首次计数时设置窗口 TTL（滑动窗口的简化实现）。
      await this.redis.expire(failKey, windowSeconds);
    }

    if (count >= threshold) {
      await this.block(ip, reason, banSeconds);
      await this.redis.del(failKey);
      return { count, banned: true };
    }
    return { count, banned: false };
  }

  private key(ip: string): string {
    return `${KEY_PREFIX}${normalizeIp(ip)}`;
  }
}
