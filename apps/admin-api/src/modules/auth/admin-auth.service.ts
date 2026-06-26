import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { jwtConfig } from '@core/config';
import { BusinessException } from '@core/common';
import { RequestContextService } from '@core/request-context';
import {
  TokenService,
  TokenBlacklistService,
  parseExpiresIn,
  type AdminAuthUser,
  type RefreshAuthUser,
} from '@platform/auth';
import {
  AdminUserService,
  IdentityErrorCode,
  LoginService,
  SecurityEventService,
  SessionService,
  UserStatus,
} from '@domains/identity';
import { RoleService } from '@domains/access-control';

import { AdminLoginDto } from './dto';

/** 管理端主体类型（管理员）。 */
const SUBJECT = 'admin' as const;

/**
 * Access token 黑名单 TTL 兜底默认值（jwtConfig 未注入时使用，如孤立单元测试）。
 *
 * 黑名单只需覆盖到 access token 自然过期即可，因此 TTL 取 access token 配置过期时长
 * （jwtConfig.accessExpiresIn）。该常量与 @core/config 的 JWT_DEFAULTS.ACCESS_EXPIRES_IN
 * ('15m' = 900s) 保持一致，仅在无法读取配置时兜底，作为 TTL 上限。
 */
const DEFAULT_BLACKLIST_TTL_SECONDS = 15 * 60;

/**
 * 已签发的会话令牌组合（应用服务内部返回结构）。
 *
 * `refreshToken` 由管理端控制器写入 HttpOnly Cookie；`refreshExpiresAt`
 * 供控制器设置 Cookie 过期使用。
 */
export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
};

/**
 * 管理后台认证应用服务。
 *
 * 承载登录/刷新/登出的跨服务编排：凭证校验委托 {@link LoginService}（subjectType
 * ='admin'），权限读取委托 {@link RoleService}，令牌签发委托 {@link TokenService}，
 * 会话管理委托 {@link SessionService}（subjectType 感知）。控制器仅做请求解析、
 * 单一服务调用与 VO 映射。
 */
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly loginService: LoginService,
    private readonly adminUserService: AdminUserService,
    private readonly sessionService: SessionService,
    private readonly roleService: RoleService,
    private readonly securityEventService: SecurityEventService,
    private readonly tokenService: TokenService,
    private readonly tokenBlacklist: TokenBlacklistService,
    // 配置可选注入：ConfigModule 全局注册时可解析；孤立测试场景回退到默认常量。
    @Optional()
    @Inject(jwtConfig.KEY)
    private readonly jwtCfg?: ConfigType<typeof jwtConfig>,
  ) {}

  /**
   * 计算 access token 黑名单 TTL（秒）。
   *
   * 黑名单只需覆盖到 access token 自然过期：
   * - 若传入有效的 access token 过期时间戳（exp，秒），取 max(exp - now, 0)；
   * - 否则回退到配置的 access 过期时长（jwtConfig.accessExpiresIn 解析为秒），
   *   再退化到保守兜底常量。
   *
   * 相比固定 7 天 TTL，按 access token 自然过期设置更精确，且显著节省 Redis。
   */
  private resolveBlacklistTtlSeconds(exp?: number): number {
    if (typeof exp === 'number' && Number.isFinite(exp)) {
      const remaining = exp - Math.floor(Date.now() / 1000);
      return Math.max(remaining, 0);
    }
    const accessExpiresIn = this.jwtCfg?.accessExpiresIn;
    return accessExpiresIn
      ? parseExpiresIn(accessExpiresIn)
      : DEFAULT_BLACKLIST_TTL_SECONDS;
  }

  /** 管理员登录：校验凭证 + 读取角色/权限 + 签发令牌并落库会话。 */
  async login(dto: AdminLoginDto): Promise<AuthSession> {
    const user = await this.loginService.verifyCredentials(
      SUBJECT,
      dto.identifier,
      dto.password,
      {
        ip: RequestContextService.getIp() ?? null,
        userAgent: RequestContextService.getUserAgent() ?? null,
      },
    );

    const [roleUids, permissionCodes] = await Promise.all([
      this.roleService.getRoleUidsForUser(user.uid),
      this.roleService.getPermissionCodesForUser(user.uid),
    ]);

    return this.establishSession(
      {
        uid: user.uid,
        username: user.username,
        passwordVersion: user.passwordVersion,
      },
      { remember: dto.remember, roleUids, permissionCodes },
    );
  }

  /**
   * 刷新令牌：状态/密码版本闸门 + 会话盗用检测 + 重新读取角色/权限 + 轮换 +
   * 安全事件（与用户端对齐的严谨刷新流程）。
   */
  async refresh(principal: RefreshAuthUser): Promise<AuthSession> {
    // 1) 加载管理员 + 状态/密码版本闸门。
    const admin = await this.adminUserService.findByUid(principal.sub);
    if (admin.status !== UserStatus.ACTIVE) {
      throw new BusinessException(IdentityErrorCode.ACCOUNT_DISABLED);
    }
    if (admin.passwordVersion !== principal.pv) {
      throw new BusinessException(IdentityErrorCode.PASSWORD_VERSION_MISMATCH);
    }

    // 2) 校验刷新会话（含盗用检测 + tokenHash 比对）。
    await this.sessionService.validateRefreshSession({
      subjectType: SUBJECT,
      userId: principal.sub,
      jti: principal.jti,
      rawToken: principal.rawToken,
    });

    // 3) 重新读取角色/权限（授权可能已变更）。
    const [roleUids, permissionCodes] = await Promise.all([
      this.roleService.getRoleUidsForUser(admin.uid),
      this.roleService.getPermissionCodesForUser(admin.uid),
    ]);

    // 4) 轮换：签发新令牌对 + 在同一 family 内创建新会话。
    const newJti = randomUUID();
    const tokens = await this.tokenService.issueTokens({
      access: this.tokenService.buildAdminPayload({
        sub: admin.uid,
        username: admin.username,
        jti: newJti,
        pv: admin.passwordVersion,
        roleUids,
        permissionCodes,
      }),
      refresh: this.tokenService.buildRefreshPayload({
        sub: admin.uid,
        jti: newJti,
        pv: admin.passwordVersion,
      }),
    });

    await this.sessionService.rotateSession({
      subjectType: SUBJECT,
      userId: admin.uid,
      oldJti: principal.jti,
      newJti,
      newRefreshToken: tokens.refreshToken,
      newExpiresAt: tokens.refreshExpiresAt,
    });

    await this.securityEventService.record({
      subjectType: SUBJECT,
      userId: admin.uid,
      eventType: 'REFRESH_SUCCESS',
      riskLevel: 'low',
      ip: RequestContextService.getIp() ?? null,
      userAgent: RequestContextService.getUserAgent() ?? null,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshExpiresAt: tokens.refreshExpiresAt,
    };
  }

  /** 登出：撤销当前会话 + 拉黑当前 jti + 记录安全事件。 */
  async logout(user: AdminAuthUser): Promise<void> {
    const session = await this.sessionService.findByUserAndJti(
      SUBJECT,
      user.sub,
      user.jti,
    );
    if (session) {
      await this.sessionService.revoke(session.uid, 'admin_logout');
    }
    // 将当前 access token 的 jti 加入黑名单，TTL 取 access token 剩余自然过期时长。
    await this.tokenBlacklist.blacklist(
      user.jti,
      this.resolveBlacklistTtlSeconds(user.exp),
    );
    await this.securityEventService.record({
      subjectType: SUBJECT,
      userId: user.sub,
      sessionUid: session?.uid ?? null,
      eventType: 'LOGOUT',
      riskLevel: 'low',
      ip: RequestContextService.getIp() ?? null,
      userAgent: RequestContextService.getUserAgent() ?? null,
    });
  }

  /**
   * 统一的「认证后」管理端会话签发入口（唯一会话签发路径）。
   *
   * 生成 jti + tokenFamilyId，按 `remember` 签发管理端 access（含 roleUids /
   * permissionCodes）+ refresh 令牌对，并落库会话（subjectType='admin'，
   * tokenHash = refresh 明文 SHA256，expiresAt 取自 `issueTokens` 的 refreshExpiresAt，
   * 尊重 remember）。本方法**不**记录 LOGIN_SUCCESS——由认证决策点（登录/SSO 回调）记录。
   *
   * 复用方：管理端密码登录（本服务）、管理端 SSO 回调（admin-api SSO 应用服务）。
   */
  async establishSession(
    adminUser: {
      uid: string;
      username: string | null;
      passwordVersion: number;
    },
    opts: { remember?: boolean; roleUids: string[]; permissionCodes: string[] },
  ): Promise<AuthSession> {
    const jti = randomUUID();
    const tokenFamilyId = randomUUID();

    const tokens = await this.tokenService.issueTokens({
      access: this.tokenService.buildAdminPayload({
        sub: adminUser.uid,
        username: adminUser.username,
        jti,
        pv: adminUser.passwordVersion,
        roleUids: opts.roleUids,
        permissionCodes: opts.permissionCodes,
      }),
      refresh: this.tokenService.buildRefreshPayload({
        sub: adminUser.uid,
        jti,
        pv: adminUser.passwordVersion,
      }),
      remember: opts.remember,
    });

    await this.sessionService.create({
      subjectType: SUBJECT,
      userId: adminUser.uid,
      jti,
      tokenFamilyId,
      refreshToken: tokens.refreshToken,
      ip: RequestContextService.getIp() ?? undefined,
      userAgent: RequestContextService.getUserAgent() ?? undefined,
      expiresAt: tokens.refreshExpiresAt,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshExpiresAt: tokens.refreshExpiresAt,
    };
  }
}
