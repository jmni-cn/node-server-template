import { Injectable } from '@nestjs/common';
import { BusinessException } from '@core/common';
import {
  SsoAuthorizeService,
  SsoCallbackService,
  SsoLoginCodeService,
  SsoErrorCode,
  type SsoLoginCodePayload,
} from '@integrations/sso';
import {
  EndUserService,
  IdentityErrorCode,
  SecurityEventService,
  UserStatus,
} from '@domains/identity';

import { UserAuthService, type AuthSession } from '../auth/user-auth.service';

/**
 * 用户端 SSO 应用服务。
 *
 * 承载授权跳转地址构建与回调登录的跨服务编排：授权委托
 * {@link SsoAuthorizeService}，回调换取/匹配身份委托 {@link SsoCallbackService}，
 * 会话签发统一委托 {@link UserAuthService.establishSession}。
 *
 * 回调成功后**不直接返回令牌**：通过 {@link SsoLoginCodeService} 把会话写入一次性
 * 登录码（短 TTL，单次使用），返回 `{ code }`；前端凭 code 调 {@link exchange}
 * 换取 access token + Refresh Token Cookie。令牌永不出现在回调重定向 URL 中。
 * 控制器仅做请求解析、HTTP 重定向/Cookie 与 VO 映射。
 */
@Injectable()
export class UserSsoService {
  constructor(
    private readonly authorizeService: SsoAuthorizeService,
    private readonly callbackService: SsoCallbackService,
    private readonly loginCodeService: SsoLoginCodeService,
    private readonly endUserService: EndUserService,
    private readonly securityEventService: SecurityEventService,
    private readonly userAuthService: UserAuthService,
  ) {}

  /** 构建 SSO 授权跳转地址（签发并持久化 state 防 CSRF）。 */
  async buildAuthorizeRedirect(
    provider: string,
    redirectUri?: string,
  ): Promise<{ url: string }> {
    const { url } = await this.authorizeService.buildAuthorizeRedirect(
      provider,
      {
        redirectUri,
      },
    );
    return { url };
  }

  /**
   * 回调：校验 state + 换取/匹配身份 + 状态闸门 + 签发会话 + 记录登录事件，
   * 最终把会话写入一次性登录码并返回 `{ code }`（令牌不外泄）。
   */
  async handleCallback(
    provider: string,
    code: string,
    state: string | undefined,
    redirectUri?: string,
  ): Promise<{ code: string }> {
    const { user } = await this.callbackService.handleCallback(provider, code, {
      state,
      redirectUri,
      subjectType: 'user',
    });

    // 重新加载完整用户并做状态闸门（禁用/锁定/封禁账号不得登录）。
    const fullUser = await this.endUserService.findByUid(user.uid);
    if (fullUser.status !== UserStatus.ACTIVE) {
      throw new BusinessException(IdentityErrorCode.ACCOUNT_DISABLED);
    }

    const session = await this.userAuthService.establishSession(
      {
        uid: fullUser.uid,
        username: fullUser.username,
        passwordVersion: fullUser.passwordVersion,
      },
      {},
    );

    await this.securityEventService.record({
      subjectType: 'user',
      userId: fullUser.uid,
      eventType: 'LOGIN_SUCCESS',
      riskLevel: 'low',
      metadata: { provider, sso: true },
    });

    const loginCode = await this.loginCodeService.issue({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      refreshExpiresAt: session.refreshExpiresAt.toISOString(),
      userUid: fullUser.uid,
    });

    return { code: loginCode };
  }

  /**
   * 一次性登录码换取会话：消费 code（单次），重建 {@link AuthSession}；
   * code 无效/已用/过期抛 `SSO_CODE_INVALID`。
   */
  async exchange(code: string): Promise<AuthSession> {
    const payload =
      await this.loginCodeService.consume<SsoLoginCodePayload>(code);
    if (!payload) {
      throw new BusinessException(SsoErrorCode.SSO_CODE_INVALID);
    }
    return {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      refreshExpiresAt: new Date(payload.refreshExpiresAt),
    };
  }
}
