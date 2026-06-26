import { Injectable } from '@nestjs/common';
import {
  BusinessException,
  CommonBusinessErrorCode,
  type PageResultVo,
  type PaginationDto,
} from '@core/common';
import {
  AdminUserService,
  AdminUserVo,
  CredentialService,
  SecurityEventService,
  SessionService,
  UserStatus,
} from '@domains/identity';
import { RoleService, SUPER_ADMIN_ROLE_CODE } from '@domains/access-control';

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

  /**
   * 更新管理员基础信息 / 状态。
   *
   * 自我保护：禁止操作者把自己禁用/锁定/封禁（仅 self 改 status 离开 ACTIVE 时拦截）。
   * 最后超管保护：若目标为有效超管且本次将其状态改为非 ACTIVE，且系统仅剩此一名
   * 启用超管，则拒绝。
   */
  async update(
    operatorUid: string,
    uid: string,
    dto: UpdateAdministratorDto,
  ): Promise<AdminUserVo> {
    const disabling =
      dto.status !== undefined && dto.status !== UserStatus.ACTIVE;

    if (disabling) {
      if (operatorUid === uid) {
        // 不允许把自己禁用/锁死。
        throw new BusinessException(
          CommonBusinessErrorCode.OPERATION_NOT_ALLOWED,
          { reason: 'cannot_disable_self', uid },
        );
      }
      await this.assertNotLastSuperAdmin(uid);
    }

    return this.adminUserService.update(uid, dto);
  }

  /**
   * 为管理员分配角色（全量替换）。
   *
   * 自我保护：禁止操作者清空/变更自己的角色（避免自我降权锁死）。
   * 最后超管保护：若目标当前为有效超管，且新角色集合不再包含超管角色，
   * 且系统仅剩此一名启用超管，则拒绝。
   */
  async assignRoles(
    operatorUid: string,
    uid: string,
    roleUids: string[],
  ): Promise<void> {
    // 确认管理员存在（不存在抛 ADMIN_NOT_FOUND）。
    await this.adminUserService.findByUid(uid);

    if (operatorUid === uid) {
      throw new BusinessException(
        CommonBusinessErrorCode.OPERATION_NOT_ALLOWED,
        { reason: 'cannot_change_own_roles', uid },
      );
    }

    // 若目标当前是有效超管，而新角色集合会移除其超管身份，需校验最后超管保护。
    const wasSuperAdmin = await this.roleService.isSuperAdmin(uid);
    if (wasSuperAdmin) {
      const targetRoles = await this.roleService.resolveRolesByUids(roleUids);
      const stillSuperAdmin = targetRoles.some(
        (r) => r.code === SUPER_ADMIN_ROLE_CODE,
      );
      if (!stillSuperAdmin) {
        await this.assertNotLastSuperAdmin(uid);
      }
    }

    await this.roleService.assignRolesToUser(uid, { roleUids });
  }

  /**
   * 重置管理员密码（无需旧密码）：写新密码 → 递增 pv → 吊销其全部会话 →
   * 记录 PASSWORD_CHANGED 安全事件。
   *
   * 自我保护：禁止操作者通过本接口重置自己的密码（自助修改密码走个人中心）。
   */
  async resetPassword(
    operatorUid: string,
    uid: string,
    newPassword: string,
  ): Promise<void> {
    if (operatorUid === uid) {
      throw new BusinessException(
        CommonBusinessErrorCode.OPERATION_NOT_ALLOWED,
        { reason: 'cannot_reset_own_password', uid },
      );
    }

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

  /**
   * 最后超管保护：若目标当前为有效超管且系统启用超管总数 <= 1，则拒绝。
   * 用于禁用/降级/删除会移除「唯一超管」的危险操作前置校验。
   */
  private async assertNotLastSuperAdmin(uid: string): Promise<void> {
    const isSuperAdmin = await this.roleService.isSuperAdmin(uid);
    if (!isSuperAdmin) return;

    const count = await this.roleService.countEnabledSuperAdmins();
    if (count <= 1) {
      throw new BusinessException(
        CommonBusinessErrorCode.OPERATION_NOT_ALLOWED,
        { reason: 'cannot_remove_last_super_admin', uid },
      );
    }
  }
}
