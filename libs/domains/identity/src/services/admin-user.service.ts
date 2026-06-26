/**
 * AdminUserService — 后台管理员主体服务。
 *
 * 拥有 AdminUser 仓储，负责管理员的创建、查询、列表、更新、登录时间维护与改密。
 * 凭证写入/校验委托给 CredentialService（subjectType='admin'）。
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException, createPageResult, maskIp } from '@core/common';
import type { PageResultVo, PaginationDto } from '@core/common';
import { AdminUser } from '../entities/admin-user.entity';
import { UserStatus } from '../entities/user-status.enum';
import { AdminUserVo } from '../vo/admin-user.vo';
import { AdminUserMapper } from '../mapper/admin-user.mapper';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UpdateAdminUserDto } from '../dto/update-admin-user.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { CredentialService } from './credential.service';
import { SessionService } from './session.service';
import { SecurityEventService } from './security-event.service';
import { IdentityErrorCode } from '../constants/identity-error-codes';

const SUBJECT = 'admin' as const;

@Injectable()
export class AdminUserService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    private readonly credentialService: CredentialService,
    private readonly sessionService: SessionService,
    private readonly securityEventService: SecurityEventService,
  ) {}

  /** 创建管理员 + 写入密码凭证（用户名唯一）。返回实体。 */
  async create(input: CreateAdminUserDto): Promise<AdminUser> {
    const existingByUsername = await this.findByUsername(input.username);
    if (existingByUsername) {
      throw new BusinessException(IdentityErrorCode.USER_USERNAME_TAKEN);
    }
    if (input.email) {
      const existingByEmail = await this.findByEmail(input.email);
      if (existingByEmail) {
        throw new BusinessException(IdentityErrorCode.USER_EMAIL_TAKEN);
      }
    }

    let admin: AdminUser;
    try {
      admin = await this.adminUserRepository.save(
        this.adminUserRepository.create({
          username: input.username,
          email: input.email ?? null,
          nickname: input.nickname ?? null,
          status: UserStatus.ACTIVE,
        }),
      );
    } catch (err) {
      // 前置检查与 save 之间存在竞态窗口；数据库唯一约束为最终防线，
      // 捕获 MySQL 唯一冲突并按违反的列重抛具体业务错误。
      throw this.rethrowAsConflict(err, input);
    }
    await this.credentialService.setPassword(
      SUBJECT,
      admin.uid,
      input.password,
    );
    return admin;
  }

  /**
   * 将 MySQL 唯一约束冲突（ER_DUP_ENTRY / errno 1062）按违反的列映射为具体业务错误：
   * email → USER_EMAIL_TAKEN，否则回退 USER_USERNAME_TAKEN（管理员登录账号）。
   * 非唯一冲突错误原样抛出。
   */
  private rethrowAsConflict(
    err: unknown,
    input: CreateAdminUserDto,
  ): unknown {
    const e = err as { code?: string; errno?: number; sqlMessage?: string };
    const isDup = e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062;
    if (!isDup) return err;

    const msg = (e?.sqlMessage ?? '').toLowerCase();
    if (
      msg.includes('email') ||
      (input.email && msg.includes(input.email.toLowerCase()))
    ) {
      return new BusinessException(IdentityErrorCode.USER_EMAIL_TAKEN);
    }
    return new BusinessException(IdentityErrorCode.USER_USERNAME_TAKEN);
  }

  /** 按 UID 查询管理员（不存在抛 ADMIN_NOT_FOUND）。 */
  async findByUid(uid: string): Promise<AdminUser> {
    const admin = await this.adminUserRepository.findOne({ where: { uid } });
    if (!admin) {
      throw new BusinessException(IdentityErrorCode.ADMIN_NOT_FOUND);
    }
    return admin;
  }

  /** 按 UID 查询管理员 VO（不存在抛 ADMIN_NOT_FOUND）。 */
  async getVo(uid: string): Promise<AdminUserVo> {
    const admin = await this.findByUid(uid);
    return AdminUserMapper.toVo(admin);
  }

  /** 按用户名查询（不存在返回 null）。 */
  async findByUsername(username: string): Promise<AdminUser | null> {
    return this.adminUserRepository.findOne({ where: { username } });
  }

  /** 按邮箱查询（不存在返回 null）。 */
  async findByEmail(email: string): Promise<AdminUser | null> {
    return this.adminUserRepository.findOne({ where: { email } });
  }

  /** 分页查询管理员列表。 */
  async list(pagination: PaginationDto): Promise<PageResultVo<AdminUserVo>> {
    const page = pagination.page ?? 1;
    const pageSize = pagination.pageSize ?? 10;

    const [items, total] = await this.adminUserRepository.findAndCount({
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return createPageResult(
      AdminUserMapper.toVoArray(items),
      total,
      page,
      pageSize,
    );
  }

  /**
   * 更新管理员基础信息。
   *
   * 安全：当 status 由 ACTIVE 变为非 ACTIVE（禁用/锁定/封禁）时，即时使该管理员下线——
   * 撤销其全部会话 + 递增密码版本（pv），令在途的 access token 在下次请求时被
   * ACCESS_SESSION_VALIDATOR 的 pv 校验拒绝，避免被禁用账号继续凭旧令牌访问。
   */
  async update(uid: string, dto: UpdateAdminUserDto): Promise<AdminUserVo> {
    const admin = await this.findByUid(uid);
    const wasActive = admin.status === UserStatus.ACTIVE;
    if (dto.email !== undefined) admin.email = dto.email ?? null;
    if (dto.status !== undefined) admin.status = dto.status;
    const becameInactive = wasActive && admin.status !== UserStatus.ACTIVE;
    const saved = await this.adminUserRepository.save(admin);

    if (becameInactive) {
      await this.sessionService.revokeAllForUser(SUBJECT, saved.uid, 'disabled');
      await this.incrementPasswordVersion(saved.uid);
      await this.securityEventService.record({
        subjectType: SUBJECT,
        userId: saved.uid,
        eventType: 'ACCOUNT_DISABLED',
        riskLevel: 'high',
        metadata: { status: saved.status },
      });
    }

    return AdminUserMapper.toVo(saved);
  }

  /** 更新最后登录时间（可选记录登录 IP）。 */
  async updateLastLogin(uid: string, ip?: string | null): Promise<void> {
    await this.adminUserRepository.update(
      { uid },
      { lastLoginAt: new Date(), lastLoginIp: maskIp(ip) },
    );
  }

  /** 递增密码版本号（pv），使旧令牌失效。 */
  async incrementPasswordVersion(uid: string): Promise<void> {
    await this.adminUserRepository.increment({ uid }, 'passwordVersion', 1);
  }

  /**
   * 累计一次登录失败：failedLoginCount+1 并刷新 lastFailedLoginAt，
   * 返回累计后的失败次数（供调用方判定是否需要锁定）。
   */
  async incrementFailedLogin(uid: string): Promise<number> {
    await this.adminUserRepository.increment({ uid }, 'failedLoginCount', 1);
    await this.adminUserRepository.update(
      { uid },
      { lastFailedLoginAt: new Date() },
    );
    const admin = await this.adminUserRepository.findOne({
      where: { uid },
      select: ['uid', 'failedLoginCount'],
    });
    return admin?.failedLoginCount ?? 0;
  }

  /** 重置登录失败计数与锁定状态（成功登录后调用）。 */
  async resetFailedLogin(uid: string): Promise<void> {
    await this.adminUserRepository.update(
      { uid },
      { failedLoginCount: 0, lockedUntil: null },
    );
  }

  /** 锁定账户至指定分钟后（写入 lockedUntil）。 */
  async lockUser(uid: string, lockMinutes: number): Promise<void> {
    const lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
    await this.adminUserRepository.update({ uid }, { lockedUntil });
  }

  /**
   * 修改管理员密码：校验旧密码 → 写新密码 → 递增 pv → 撤销全部会话 →
   * 记录 PASSWORD_CHANGED 安全事件。
   */
  async changePassword(uid: string, dto: ChangePasswordDto): Promise<void> {
    const admin = await this.findByUid(uid);
    const matched = await this.credentialService.verify(
      SUBJECT,
      admin.uid,
      dto.oldPassword,
    );
    if (!matched) {
      throw new BusinessException(IdentityErrorCode.USER_PASSWORD_INCORRECT);
    }
    await this.credentialService.setPassword(
      SUBJECT,
      admin.uid,
      dto.newPassword,
    );
    await this.adminUserRepository.increment({ uid }, 'passwordVersion', 1);
    await this.sessionService.revokeAllForUser(
      SUBJECT,
      admin.uid,
      'password_changed',
    );
    await this.securityEventService.record({
      subjectType: SUBJECT,
      userId: admin.uid,
      eventType: 'PASSWORD_CHANGED',
      riskLevel: 'high',
    });
  }
}
