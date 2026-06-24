import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { generateSecureToken } from '@core/common';
import { ssoConfig } from '@core/config';
import { CacheService } from '@platform/cache';
import { SSO_LOGIN_CODE_NAMESPACE } from '../constants';
import type { SsoLoginCodePayload } from '../types/sso-provider.port';

/**
 * SSO 一次性登录码服务（SPA 安全令牌交接）。
 *
 * 回调成功后，会话令牌不直接出现在重定向 URL 中：本服务把 {@link SsoLoginCodePayload}
 * 以单次使用、短 TTL（默认 60s）写入 Redis（命名空间 `sso:logincode`），返回随机 code；
 * 前端凭 code 调 `POST /sso/exchange`，由 {@link consume} 通过
 * {@link CacheService.getAndDel} 原子读取并失效，换取 access token + Refresh Cookie。
 */
@Injectable()
export class SsoLoginCodeService {
  constructor(
    private readonly cache: CacheService,
    @Inject(ssoConfig.KEY)
    private readonly cfg: ConfigType<typeof ssoConfig>,
  ) {}

  /** 签发一次性登录码并写入缓存（TTL = ssoConfig.loginCodeTtl），返回 code。 */
  async issue(payload: SsoLoginCodePayload): Promise<string> {
    const code = generateSecureToken();
    await this.cache.set(
      code,
      payload,
      this.cfg.loginCodeTtl,
      SSO_LOGIN_CODE_NAMESPACE,
    );
    return code;
  }

  /** 消费一次性登录码（原子读取并删除）；不存在/已用返回 null。 */
  async consume<T = SsoLoginCodePayload>(code: string): Promise<T | null> {
    return this.cache.getAndDel<T>(code, SSO_LOGIN_CODE_NAMESPACE);
  }
}
