import { Injectable } from '@nestjs/common';
import type { PageResultVo, PaginationDto } from '@core/common';
import {
  AdminUserService,
  AdminUserVo,
  CredentialService,
  SecurityEventService,
  SessionService,
} from '@domains/identity';
import { RoleService } from '@domains/access-control';

import { CreateAdministratorDto, UpdateAdministratorDto } from './dto';

/** 管理端主体类型（管理员）。 */
const SUBJECT = 'admin' as const;

/**
 * 管理员账号应用服务。
 *
 * 承载管理员账号管理的跨服务编排：账号 CRUD 委托 {@link AdminUserService}，
 * 角色绑定委托 {@link RoleService}，密码凭证委托 {@link CredentialService}，
 * 会话吊销委托 {@link SessionService}。控制器仅做请求解析与单一方法调用。
 *
 * 注意：本服务管理的是「管理员账号」（AdminUser / admin_users 表），与终端用户
 * （EndUser）严格分离。
 */
@Injectable()
export class AdministratorsService {
  constructor(
    private readonly adminUserService: AdminUserService,
    private readonly roleService: RoleService,
    private readonly credentialService: CredentialService,
    private readonly sessionService: SessionService,
    private readonly securityEventService: SecurityEventService,
  ) {}

  /**
   * 创建管理员：建账号 + 写初始密码 + 可选分配初始角色。
   *
   * AdminUserService.create 内部已写入密码凭证（subjectType='admin'），此处密码
   * 由 create 完成；若传入 roleUids 则额外分配角色。返回管理员 VO。
   */
  async create(dto: CreateAdministratorDto): Promise<AdminUserVo> {
    const admin = await this.adminUserService.create({
      username: dto.username,
      email: dto.email,
      password: dto.password,
    });

    if (dto.roleUids?.length) {
      await this.roleService.assignRolesToUser(admin.uid, {
        roleUids: dto.roleUids,
      });
    }

    return this.adminUserService.getVo(admin.uid);
  }

  /** 分页查询管理员列表。 */
  list(pagination: PaginationDto): Promise<PageResultVo<AdminUserVo>> {
    return this.adminUserService.list(pagination);
  }

  /** 管理员详情（含其角色 UID 列表）。 */
  async detail(uid: string): Promise<AdminUserVo & { roleUids: string[] }> {
    const [vo, roleUids] = await Promise.all([
      this.adminUserService.getVo(uid),
      this.roleService.getRoleUidsForUser(uid),
    ]);
    return { ...vo, roleUids };
  }

  /** 更新管理员基础信息 / 状态。 */
  update(uid: string, dto: UpdateAdministratorDto): Promise<AdminUserVo> {
    return this.adminUserService.update(uid, dto);
  }

  /** 为管理员分配角色（全量替换）。 */
  async assignRoles(uid: string, roleUids: string[]): Promise<void> {
    // 确认管理员存在（不存在抛 ADMIN_NOT_FOUND）。
    await this.adminUserService.findByUid(uid);
    await this.roleService.assignRolesToUser(uid, { roleUids });
  }

  /**
   * 重置管理员密码（无需旧密码）：写新密码 → 递增 pv → 吊销其全部会话 →
   * 记录 PASSWORD_CHANGED 安全事件。
   */
  async resetPassword(uid: string, newPassword: string): Promise<void> {
    await this.adminUserService.findByUid(uid);
    await this.credentialService.setPassword(SUBJECT, uid, newPassword);
    await this.adminUserService.incrementPasswordVersion(uid);
    await this.sessionService.revokeAllForUser(
      SUBJECT,
      uid,
      'password_reset_by_admin',
    );
    await this.securityEventService.record({
      subjectType: SUBJECT,
      userId: uid,
      eventType: 'PASSWORD_CHANGED',
      riskLevel: 'high',
      metadata: { resetByAdmin: true },
    });
  }
}
