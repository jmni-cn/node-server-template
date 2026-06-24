import { Injectable } from '@nestjs/common';
import { RedisService } from '@platform/cache';

/**
 * Token 黑名单服务
 *
 * 基于 Redis 维护已撤销的 Token（按 jti），用于登出 / 强制下线等场景。
 * key 形如 `auth:blacklist:<jti>`，到期自动清理。
 */
@Injectable()
export class TokenBlacklistService {
  private static readonly KEY_PREFIX = 'auth:blacklist:';

  constructor(private readonly redis: RedisService) {}

  private buildKey(jti: string): string {
    return `${TokenBlacklistService.KEY_PREFIX}${jti}`;
  }

  /**
   * 将指定 jti 加入黑名单，ttl 秒后自动失效。
   *
   * @param jti        会话 / Token 标识
   * @param ttlSeconds 过期秒数（通常与 Token 剩余有效期一致）
   */
  async blacklist(jti: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(this.buildKey(jti), '1', ttlSeconds);
  }

  /**
   * 判断指定 jti 是否已被列入黑名单。
   */
  async isBlacklisted(jti: string): Promise<boolean> {
    return this.redis.exists(this.buildKey(jti));
  }
}
