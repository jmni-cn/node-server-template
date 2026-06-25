import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { BusinessException } from '@core/common';
import { RequestContextService } from '@core/request-context';
import {
  TokenService,
  TokenBlacklistService,
  type RefreshAuthUser,
  type UserAuthUser,
} from '@platform/auth';
import {
  EndUserService,
  IdentityErrorCode,
  LoginDto,
  LoginService,
  RegisterDto,
  RegisterService,
  SecurityEventService,
  SessionService,
  UserStatus,
} from '@domains/identity';

/** 用户端主体类型（终端用户）。 */
const SUBJECT = 'user' as const;

/** Access token 黑名单保留时长（7 天，单位：秒）。 */
const BLACKLIST_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * 已签发的会话令牌组合（应用服务内部返回结构）。
 *
 * `refreshToken` 仅供控制器写入 HttpOnly Cookie，不进入 HTTP 响应体；
 * `refreshExpiresAt` 供控制器设置 Cookie 过期使用。
 */
export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
};

/**
 * 用户端认证应用服务。
 *
 * 承载注册/登录/刷新/登出的跨服务编排：凭证与注册委托领域服务、令牌签发委托
 * {@link TokenService}、会话与盗用检测委托 {@link SessionService}、安全事件委托
 * {@link SecurityEventService}。HTTP 传输（Cookie/Res）由控制器负责，本服务只返回
 * 纯数据；ip/userAgent 通过 {@link RequestContextService} 读取，控制器无需透传。
 */
@Injectable()
export class UserAuthService {
  constructor(
    private readonly registerService: RegisterService,
    private readonly loginService: LoginService,
    private readonly endUserService: EndUserService,
    private readonly sessionService: SessionService,
    private readonly securityEventService: SecurityEventService,
    private readonly tokenService: TokenService,
    private readonly tokenBlacklist: TokenBlacklistService,
  ) {}

  /** 用户注册：创建账号后签发令牌并落库会话。 */
  async register(dto: RegisterDto): Promise<AuthSession> {
    const user = await this.registerService.register(dto);
    return this.establishSession({
      uid: user.uid,
      username: user.username,
      passwordVersion: 0,
    });
  }

  /** 用户登录：校验凭证后签发令牌并落库会话。 */
  async login(dto: LoginDto): Promise<AuthSession> {
    const user = await this.loginService.verifyCredentials(
      SUBJECT,
      dto.identifier,
      dto.password,
      {
        ip: RequestContextService.getIp() ?? null,
        userAgent: RequestContextService.getUserAgent() ?? null,
      },
    );
    return this.establishSession(
      {
        uid: user.uid,
        username: user.username,
        passwordVersion: user.passwordVersion,
      },
      { remember: dto.remember },
    );
  }

  /**
   * 统一的「认证后」会话签发入口（唯一会话签发路径）。
   *
   * 生成 jti + tokenFamilyId，按 `remember` 签发 access/refresh 令牌对，并落库会话
   * （tokenHash = refresh 明文 SHA256，expiresAt 取自 `issueTokens` 的 refreshExpiresAt，
   * 尊重 remember）。本方法**不**记录 LOGIN_SUCCESS——由认证决策点（登录/SSO 回调）记录。
   *
   * 复用方：密码登录/注册（本服务）、SSO 回调（user-api SSO 应用服务）。
   */
  async establishSession(
    user: { uid: string; username: string | null; passwordVersion: number },
    opts?: { remember?: boolean },
  ): Promise<AuthSession> {
    const jti = randomUUID();
    const tokenFamilyId = randomUUID();

    const tokens = await this.tokenService.issueTokens({
      access: this.tokenService.buildUserPayload({
        sub: user.uid,
        username: user.username,
        jti,
        pv: user.passwordVersion,
      }),
      refresh: this.tokenService.buildRefreshPayload({
        sub: user.uid,
        jti,
        pv: user.passwordVersion,
      }),
      remember: opts?.remember,
    });

    await this.sessionService.create({
      subjectType: SUBJECT,
      userId: user.uid,
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

  /** 刷新令牌：状态/密码版本闸门 + 会话盗用检测 + 轮换 + 安全事件。 */
  async refresh(principal: RefreshAuthUser): Promise<AuthSession> {
    // 1) 加载用户 + 状态/密码版本闸门。
    const user = await this.endUserService.findByUid(principal.sub);
    if (user.status !== UserStatus.ACTIVE) {
      throw new BusinessException(IdentityErrorCode.ACCOUNT_DISABLED);
    }
    if (user.passwordVersion !== principal.pv) {
      throw new BusinessException(IdentityErrorCode.PASSWORD_VERSION_MISMATCH);
    }

    // 2) 校验刷新会话（含盗用检测 + tokenHash 比对）。
    await this.sessionService.validateRefreshSession({
      subjectType: SUBJECT,
      userId: principal.sub,
      jti: principal.jti,
      rawToken: principal.rawToken,
    });

    // 3) 轮换：签发新令牌对 + 在同一 family 内创建新会话。
    const newJti = randomUUID();
    const tokens = await this.tokenService.issueTokens({
      access: this.tokenService.buildUserPayload({
        sub: user.uid,
        username: user.username,
        jti: newJti,
        pv: user.passwordVersion,
      }),
      refresh: this.tokenService.buildRefreshPayload({
        sub: user.uid,
        jti: newJti,
        pv: user.passwordVersion,
      }),
    });

    await this.sessionService.rotateSession({
      subjectType: SUBJECT,
      userId: user.uid,
      oldJti: principal.jti,
      newJti,
      newRefreshToken: tokens.refreshToken,
      newExpiresAt: tokens.refreshExpiresAt,
    });

    await this.securityEventService.record({
      subjectType: SUBJECT,
      userId: user.uid,
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
  async logout(user: UserAuthUser): Promise<void> {
    const session = await this.sessionService.findByUserAndJti(
      SUBJECT,
      user.sub,
      user.jti,
    );
    if (session) {
      await this.sessionService.revoke(session.uid, 'user_logout');
    }
    await this.tokenBlacklist.blacklist(user.jti, BLACKLIST_TTL_SECONDS);
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

  /** 登出全部设备：撤销该用户全部会话 + 拉黑当前 jti + 记录安全事件。 */
  async logoutAll(user: UserAuthUser): Promise<void> {
    await this.sessionService.revokeAllForUser(
      SUBJECT,
      user.sub,
      'user_logout_all',
    );
    await this.tokenBlacklist.blacklist(user.jti, BLACKLIST_TTL_SECONDS);
    await this.securityEventService.record({
      subjectType: SUBJECT,
      userId: user.sub,
      eventType: 'LOGOUT_ALL',
      riskLevel: 'medium',
      ip: RequestContextService.getIp() ?? null,
      userAgent: RequestContextService.getUserAgent() ?? null,
    });
  }
}
