import { Injectable } from '@nestjs/common';
import { BusinessException } from '@core/common';
import { OperationLogService } from '@platform/audit';
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
    private readonly operationLogService: OperationLogService,
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
   * 构建「绑定意图」SSO 授权跳转地址：把发起绑定的已登录用户写入 state，
   * 回调阶段据此把经验证的外部身份绑定到该用户（不登录、不开户）。
   *
   * @param provider provider 标识。
   * @param userId 当前已登录用户 UID（从 JWT 的 sub 取，控制器层注入）。
   */
  async buildBindAuthorizeRedirect(
    provider: string,
    userId: string,
  ): Promise<{ url: string }> {
    const { url } = await this.authorizeService.buildAuthorizeRedirect(
      provider,
      {
        intent: 'bind',
        bindSubjectType: 'user',
        bindUserId: userId,
      },
    );
    return { url };
  }

  /**
   * 回调：按 state.intent 分流。
   * - 'login'：校验 state + 换取/匹配身份 + 状态闸门 + 签发会话 + 记录登录事件，
   *   把会话写入一次性登录码并返回 `{ intent: 'login', code }`（令牌不外泄）；
   * - 'bind'：把经验证的外部身份绑定到 state 携带的已登录用户（绑定+审计由
   *   integrations/sso 完成），返回 `{ intent: 'bind', provider }`，**不签发会话**。
   */
  async handleCallback(
    provider: string,
    code: string,
    state: string | undefined,
    redirectUri?: string,
  ): Promise<
    { intent: 'login'; code: string } | { intent: 'bind'; provider: string }
  > {
    const result = await this.callbackService.handleCallback(provider, code, {
      state,
      redirectUri,
      subjectType: 'user',
    });

    // 绑定意图：绑定已在 integrations/sso 完成（含审计），此处仅返回结果。
    if (result.intent === 'bind') {
      return { intent: 'bind', provider };
    }

    const { user } = result;

    // 重新加载完整用户并做状态闸门（禁用/锁定/封禁账号不得登录）。
    const fullUser = await this.endUserService.findByUid(user.uid);
    if (fullUser.status !== UserStatus.ACTIVE) {
      throw new BusinessException(IdentityErrorCode.ACCOUNT_DISABLED);
    }
    // 账户锁定闸门：与密码登录一致，lockedUntil 未过期则拒绝 SSO 登录，
    // 避免 SSO 路径绕过暴力破解锁定。
    if (fullUser.lockedUntil && fullUser.lockedUntil.getTime() > Date.now()) {
      throw new BusinessException(IdentityErrorCode.USER_LOCKED);
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

    // 审计：SSO 回调用 @Res() 重定向，无法走 OperationLogInterceptor，
    // 故在此显式同步落库一条 SSO_LOGIN 操作日志（操作人/IP/设备从 RequestContext 兜底）。
    await this.operationLogService.createWithContext({
      module: 'OAuth',
      action: 'SSO_LOGIN',
      method: 'GET',
      path: `/sso/${provider}/callback`,
      sub: fullUser.uid,
      username: fullUser.username,
      result: { provider, success: true },
    });

    return { intent: 'login', code: loginCode };
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
