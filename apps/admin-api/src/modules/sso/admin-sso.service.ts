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
  AdminUserService,
  IdentityErrorCode,
  SecurityEventService,
  UserStatus,
} from '@domains/identity';
import { RoleService } from '@domains/access-control';

import { AdminAuthService, type AuthSession } from '../auth/admin-auth.service';

/**
 * 管理后台 SSO 应用服务。
 *
 * 承载授权跳转地址构建与回调登录的跨服务编排：授权委托
 * {@link SsoAuthorizeService}，回调换取/匹配身份委托 {@link SsoCallbackService}，
 * 角色/权限读取委托 {@link RoleService}，会话签发统一委托
 * {@link AdminAuthService.establishSession}。
 *
 * 与用户端一致：回调成功后**不直接返回令牌**，而是经 {@link SsoLoginCodeService}
 * 签发一次性登录码（短 TTL，单次使用），返回 `{ code }`；前端凭 code 调
 * {@link exchange} 换取令牌。令牌永不出现在回调重定向 URL 中。
 */
@Injectable()
export class AdminSsoService {
  constructor(
    private readonly authorizeService: SsoAuthorizeService,
    private readonly callbackService: SsoCallbackService,
    private readonly loginCodeService: SsoLoginCodeService,
    private readonly adminUserService: AdminUserService,
    private readonly roleService: RoleService,
    private readonly securityEventService: SecurityEventService,
    private readonly adminAuthService: AdminAuthService,
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
   * 回调：校验 state + 换取/匹配身份 + 状态闸门 + 读取角色/权限 + 签发会话，
   * 最终把会话写入一次性登录码并返回 `{ code }`（令牌不外泄）。
   */
  async handleCallback(
    provider: string,
    code: string,
    state: string | undefined,
    redirectUri?: string,
  ): Promise<{ code: string }> {
    const result = await this.callbackService.handleCallback(provider, code, {
      state,
      redirectUri,
      subjectType: 'admin',
    });
    // 管理端 SSO 仅发起登录意图，回调必为 login；其它意图视为状态异常。
    if (result.intent !== 'login') {
      throw new BusinessException(SsoErrorCode.SSO_STATE_MISMATCH);
    }
    const { user } = result;

    // 重新加载完整管理员并做状态闸门。
    const fullUser = await this.adminUserService.findByUid(user.uid);
    if (fullUser.status !== UserStatus.ACTIVE) {
      throw new BusinessException(IdentityErrorCode.ACCOUNT_DISABLED);
    }

    const [roleUids, permissionCodes] = await Promise.all([
      this.roleService.getRoleUidsForUser(fullUser.uid),
      this.roleService.getPermissionCodesForUser(fullUser.uid),
    ]);

    const session = await this.adminAuthService.establishSession(
      {
        uid: fullUser.uid,
        username: fullUser.username,
        passwordVersion: fullUser.passwordVersion,
      },
      { roleUids, permissionCodes },
    );

    await this.securityEventService.record({
      subjectType: 'admin',
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
