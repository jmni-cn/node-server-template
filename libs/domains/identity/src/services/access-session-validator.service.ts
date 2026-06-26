/**
 * IdentityAccessSessionValidator — @platform/auth `ACCESS_SESSION_VALIDATOR` 端口实现。
 *
 * 在 access token 完成签名 + 字段校验后，进一步确认令牌对应的「会话 + 用户」
 * 当前仍然有效：
 * 1. 会话存在且未撤销（按 subjectType + userId + jti）；
 * 2. 用户存在且状态 ACTIVE；
 * 3. 令牌 pv 与用户当前 passwordVersion 一致（改密 / logoutAll 会递增 pv）。
 *
 * 任一不满足均抛业务异常（最终由全局过滤器映射为 401/403），从而获得
 * 「实时吊销会话 / 改密即时失效在途 access token」的能力。
 *
 * 本服务显式 `implements AccessSessionValidator`（与 `AccessCheckService implements
 * AccessChecker`、`SecurityEventRecorderAdapter implements SecurityEventRecorder`
 * 保持一致），由 @Global 的 IdentityModule 以
 * `{ provide: ACCESS_SESSION_VALIDATOR, useExisting: IdentityAccessSessionValidator }`
 * 绑定，使 @platform/auth 的策略能在运行时解析到实现。
 */

import { Injectable } from '@nestjs/common';
import { BusinessException } from '@core/common';
import type { AccessSessionValidator } from '@platform/auth';
import { AdminUserService } from './admin-user.service';
import { EndUserService } from './end-user.service';
import { SessionService } from './session.service';
import { UserStatus } from '../entities/user-status.enum';
import type { SubjectType } from '../types/subject-type';
import { IdentityErrorCode } from '../constants/identity-error-codes';

@Injectable()
export class IdentityAccessSessionValidator implements AccessSessionValidator {
  constructor(
    private readonly adminUserService: AdminUserService,
    private readonly endUserService: EndUserService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * 校验 access token 对应的会话与用户是否实时有效；失败抛业务异常。
   */
  async validateAccess(input: {
    subjectType: 'admin' | 'user';
    sub: string;
    jti: string;
    pv: number;
  }): Promise<void> {
    const subjectType = input.subjectType as SubjectType;

    // 1) 会话有效性：存在且未撤销、未过期。
    const session = await this.sessionService.findByUserAndJti(
      subjectType,
      input.sub,
      input.jti,
    );
    if (!session || session.revokedAt) {
      throw new BusinessException(IdentityErrorCode.SESSION_INVALID);
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new BusinessException(IdentityErrorCode.SESSION_EXPIRED);
    }

    // 2) 用户存在 + 状态 ACTIVE；3) pv 一致。
    const { status, passwordVersion } = await this.loadSubject(
      subjectType,
      input.sub,
    );
    if (status !== UserStatus.ACTIVE) {
      throw new BusinessException(IdentityErrorCode.ACCOUNT_DISABLED);
    }
    if (passwordVersion !== input.pv) {
      throw new BusinessException(IdentityErrorCode.PASSWORD_VERSION_MISMATCH);
    }
  }

  /** 按主体类型加载状态与密码版本（不存在抛对应未找到异常）。 */
  private async loadSubject(
    subjectType: SubjectType,
    sub: string,
  ): Promise<{ status: UserStatus; passwordVersion: number }> {
    if (subjectType === 'admin') {
      const admin = await this.adminUserService.findByUid(sub);
      return { status: admin.status, passwordVersion: admin.passwordVersion };
    }
    const user = await this.endUserService.findByUid(sub);
    return { status: user.status, passwordVersion: user.passwordVersion };
  }
}
