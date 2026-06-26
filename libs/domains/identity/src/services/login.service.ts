/**
 * LoginService — 登录凭证校验服务（subjectType 感知）。
 *
 * 根据 subjectType 从对应主体服务（AdminUserService / EndUserService）按标识解析主体，
 * 经 CredentialService 校验密码：
 * - 成功：更新登录时间/IP + 记录 LOGIN_SUCCESS，返回规范化的 AuthenticatedPrincipal；
 * - 主体不存在 / 密码错误：记录 LOGIN_FAILED（medium），抛 BusinessException。
 *
 * 注意：本服务只负责凭证校验，不签发任何令牌——令牌签发属于 app / auth 层职责。
 */

import { Injectable } from '@nestjs/common';
import { BusinessException } from '@core/common';
import { RuntimeConfigService } from '@platform/config';
import { IpBlacklistService, SECURITY_CONFIG_KEYS } from '@platform/security';
import { AdminUserService } from './admin-user.service';
import { EndUserService } from './end-user.service';
import { CredentialService } from './credential.service';
import { SecurityEventService } from './security-event.service';
import { UserStatus } from '../entities/user-status.enum';
import type { SubjectType } from '../types/subject-type';
import type { AuthenticatedPrincipal } from '../types';
import { IdentityErrorCode } from '../constants/identity-error-codes';

/** 登录上下文（可选；用于安全事件记录与 IP 落库）。 */
export interface LoginContext {
  ip?: string | null;
  userAgent?: string | null;
}

/** 主体解析结果（内部使用）。 */
interface ResolvedSubject {
  uid: string;
  username: string | null;
  status: UserStatus;
  passwordVersion: number;
  /** 当前锁定截止时间（仅终端用户有意义；管理员为 undefined）。 */
  lockedUntil?: Date | null;
}

@Injectable()
export class LoginService {
  constructor(
    private readonly adminUserService: AdminUserService,
    private readonly endUserService: EndUserService,
    private readonly credentialService: CredentialService,
    private readonly securityEventService: SecurityEventService,
    private readonly ipBlacklistService: IpBlacklistService,
    // 运行期配置读取（DB → env → 代码默认，fail-safe，热更新）。
    private readonly runtimeConfig: RuntimeConfigService,
  ) {}

  /**
   * 触发账户锁定的连续登录失败阈值（运行期读 security.login.max_failed）。
   * 不传内联默认：getter 未传 defaultValue 时回退到注册表 def.defaultValue，
   * 默认值仅在 SecurityModule 的定义注册表里出现一处。
   */
  private async getMaxFailedLogin(): Promise<number> {
    return this.runtimeConfig.getNumber(
      SECURITY_CONFIG_KEYS.LOGIN_MAX_FAILED,
    );
  }

  /** 账户锁定时长（分钟）（运行期读 security.login.lock_minutes）。 */
  private async getAccountLockMinutes(): Promise<number> {
    return this.runtimeConfig.getNumber(
      SECURITY_CONFIG_KEYS.LOGIN_LOCK_MINUTES,
    );
  }

  /**
   * 校验登录凭证，成功返回规范化的已认证主体（AuthenticatedPrincipal）。
   *
   * 不签发任何令牌——令牌签发是 app / auth 层职责。
   */
  async verifyCredentials(
    subjectType: SubjectType,
    identifier: string,
    password: string,
    ctx?: LoginContext,
  ): Promise<AuthenticatedPrincipal> {
    // 0) IP 黑名单闸门：命中直接拒绝，不进入凭证校验。
    if (ctx?.ip && (await this.ipBlacklistService.isBlocked(ctx.ip))) {
      throw new BusinessException(IdentityErrorCode.USER_LOCKED);
    }

    const subject = await this.resolveByIdentifier(subjectType, identifier);
    if (!subject) {
      // 主体不存在也返回与「密码错误」一致的 INVALID_CREDENTIALS，避免账号枚举。
      // 此处 userId 为 null，不触发任何账户级失败计数（仅记录安全事件 / IP 风控）。
      await this.recordFailure(subjectType, null, identifier, ctx);
      throw new BusinessException(IdentityErrorCode.INVALID_CREDENTIALS);
    }

    // 1) 账户锁定闸门（管理员与终端用户均适用）：lockedUntil 未过期则拒绝登录。
    if (
      subject.lockedUntil &&
      subject.lockedUntil.getTime() > Date.now()
    ) {
      await this.recordFailure(subjectType, subject.uid, identifier, ctx);
      throw new BusinessException(IdentityErrorCode.USER_LOCKED);
    }

    if (subject.status !== UserStatus.ACTIVE) {
      await this.recordFailure(subjectType, subject.uid, identifier, ctx);
      throw new BusinessException(IdentityErrorCode.USER_DISABLED);
    }

    const matched = await this.credentialService.verify(
      subjectType,
      subject.uid,
      password,
    );
    if (!matched) {
      // 密码错误：累计失败计数，达阈值则锁定（管理员与终端用户均适用）。
      const failed = await this.subjectService(subjectType).incrementFailedLogin(
        subject.uid,
      );
      if (failed >= (await this.getMaxFailedLogin())) {
        await this.subjectService(subjectType).lockUser(
          subject.uid,
          await this.getAccountLockMinutes(),
        );
      }
      await this.recordFailure(subjectType, subject.uid, identifier, ctx);
      throw new BusinessException(IdentityErrorCode.INVALID_CREDENTIALS);
    }

    // 成功登录：重置失败计数 / 解锁（管理员与终端用户均适用），刷新登录时间。
    await this.subjectService(subjectType).resetFailedLogin(subject.uid);
    await this.updateLastLogin(subjectType, subject.uid, ctx?.ip);
    await this.securityEventService.record({
      subjectType,
      userId: subject.uid,
      eventType: 'LOGIN_SUCCESS',
      riskLevel: 'low',
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });

    return {
      uid: subject.uid,
      username: subject.username,
      passwordVersion: subject.passwordVersion,
      status: subject.status,
    };
  }

  /** 按标识（用户名/邮箱；终端用户额外支持手机号）解析主体。 */
  private async resolveByIdentifier(
    subjectType: SubjectType,
    identifier: string,
  ): Promise<ResolvedSubject | null> {
    if (subjectType === 'admin') {
      const admin =
        (await this.adminUserService.findByUsername(identifier)) ??
        (await this.adminUserService.findByEmail(identifier));
      return admin
        ? {
            uid: admin.uid,
            username: admin.username,
            status: admin.status,
            passwordVersion: admin.passwordVersion,
            lockedUntil: admin.lockedUntil,
          }
        : null;
    }
    const user =
      (await this.endUserService.findByUsername(identifier)) ??
      (await this.endUserService.findByEmail(identifier)) ??
      (await this.endUserService.findByPhone(identifier));
    return user
      ? {
          uid: user.uid,
          username: user.username,
          status: user.status,
          passwordVersion: user.passwordVersion,
          lockedUntil: user.lockedUntil,
        }
      : null;
  }

  /**
   * 按 subjectType 返回承载「登录失败计数 / 锁定」能力的主体服务。
   * AdminUserService 与 EndUserService 暴露同名方法
   * （incrementFailedLogin / lockUser / resetFailedLogin），可统一调用。
   */
  private subjectService(subjectType: SubjectType): {
    incrementFailedLogin(uid: string): Promise<number>;
    lockUser(uid: string, lockMinutes: number): Promise<void>;
    resetFailedLogin(uid: string): Promise<void>;
  } {
    return subjectType === 'admin'
      ? this.adminUserService
      : this.endUserService;
  }

  private async updateLastLogin(
    subjectType: SubjectType,
    uid: string,
    ip?: string | null,
  ): Promise<void> {
    if (subjectType === 'admin') {
      await this.adminUserService.updateLastLogin(uid, ip);
    } else {
      await this.endUserService.updateLastLogin(uid, ip);
    }
  }

  private async recordFailure(
    subjectType: SubjectType,
    userId: string | null,
    identifier: string,
    ctx?: LoginContext,
  ): Promise<void> {
    await this.securityEventService.record({
      subjectType,
      userId,
      eventType: 'LOGIN_FAILED',
      riskLevel: 'medium',
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
      metadata: { identifier },
    });

    // IP 风控：窗口内累计登录失败达阈值则自动封禁来源 IP。
    // 不再传 options：窗口/阈值/封禁秒数由 IpBlacklistService 运行期从
    // security.ip.* 解析（DB → env → 代码默认，热更新）。
    if (ctx?.ip) {
      await this.ipBlacklistService.recordSuspiciousActivity(
        ctx.ip,
        'login_failed_threshold',
      );
    }
  }
}
