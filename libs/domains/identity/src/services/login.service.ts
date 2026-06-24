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
}

@Injectable()
export class LoginService {
  constructor(
    private readonly adminUserService: AdminUserService,
    private readonly endUserService: EndUserService,
    private readonly credentialService: CredentialService,
    private readonly securityEventService: SecurityEventService,
  ) {}

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
    const subject = await this.resolveByIdentifier(subjectType, identifier);
    if (!subject) {
      await this.recordFailure(subjectType, null, identifier, ctx);
      throw new BusinessException(IdentityErrorCode.USER_NOT_FOUND);
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
      await this.recordFailure(subjectType, subject.uid, identifier, ctx);
      throw new BusinessException(IdentityErrorCode.INVALID_CREDENTIALS);
    }

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
        }
      : null;
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
  }
}
