/**
 * RoleService — 角色服务。
 *
 * 负责角色 CRUD、权限/菜单授权、用户角色分配，以及用户权限码/菜单的解析。
 * 用户权限码查询经 CacheService 缓存，授权变更时失效相关缓存。
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Like, Repository } from 'typeorm';
import {
  BusinessException,
  PageResultVo,
  createPageResult,
} from '@core/common';
import { CacheService } from '@platform/cache';

import { Role } from '../entities/role.entity';
import { UserRole } from '../entities/user-role.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { RoleMenu } from '../entities/role-menu.entity';
import { Permission } from '../entities/permission.entity';

import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { ListRoleDto } from '../dto/list-role.dto';
import { AssignPermissionsDto } from '../dto/assign-permissions.dto';
import { AssignMenusDto } from '../dto/assign-menus.dto';
import { AssignRolesDto } from '../dto/assign-roles.dto';

import { RoleVo, RoleDetailVo } from '../vo/role.vo';
import { RoleMapper } from '../mapper/role.mapper';
import { RoleAssembler } from '../assembler/role.assembler';
import { PermissionService } from './permission.service';

import { AccessErrorCode } from '../constants/access-error-codes';
import { RBAC_CACHE } from '../constants/cache.constants';
import { SUPER_ADMIN_ROLE_CODE } from '../constants/role.constants';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
    @InjectRepository(RoleMenu)
    private readonly roleMenuRepository: Repository<RoleMenu>,
    private readonly permissionService: PermissionService,
    private readonly cacheService: CacheService,
    private readonly roleAssembler: RoleAssembler,
    private readonly dataSource: DataSource,
  ) {}

  /** 创建角色（编码唯一）。 */
  async create(dto: CreateRoleDto): Promise<RoleVo> {
    const exists = await this.roleRepository.findOne({
      where: { code: dto.code },
    });
    if (exists) {
      throw new BusinessException(AccessErrorCode.RBAC_ROLE_CODE_TAKEN, {
        code: dto.code,
      });
    }

    const role = this.roleRepository.create({
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      isSystem: false,
    });
    const saved = await this.roleRepository.save(role);
    return RoleMapper.toVo(saved);
  }

  /** 更新角色（系统内置角色禁止修改）。 */
  async update(uid: string, dto: UpdateRoleDto): Promise<RoleVo> {
    const role = await this.findByUid(uid);
    if (role.isSystem) {
      throw new BusinessException(AccessErrorCode.RBAC_ROLE_IS_SYSTEM, { uid });
    }
    if (dto.name !== undefined) role.name = dto.name;
    if (dto.description !== undefined) role.description = dto.description;
    const enabledChanged =
      dto.enabled !== undefined && dto.enabled !== role.enabled;
    if (dto.enabled !== undefined) role.enabled = dto.enabled;
    const saved = await this.roleRepository.save(role);

    // 启停状态变化会影响该角色下用户的权限聚合结果，失效其权限缓存。
    if (enabledChanged) {
      await this.invalidateRolePerms(role.uid);
    }
    return RoleMapper.toVo(saved);
  }

  /** 按 uid 查询角色实体（不存在抛 RBAC_ROLE_NOT_FOUND）。 */
  async findByUid(uid: string): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { uid } });
    if (!role) {
      throw new BusinessException(AccessErrorCode.RBAC_ROLE_NOT_FOUND, { uid });
    }
    return role;
  }

  /** 将角色 uid 列表解析为角色实体列表（仅返回存在的，未软删）。 */
  async resolveRolesByUids(uids: string[]): Promise<Role[]> {
    if (!uids.length) return [];
    return this.roleRepository.find({ where: { uid: In(uids) } });
  }

  /** 获取角色详情（含权限与菜单）。 */
  async getDetail(uid: string): Promise<RoleDetailVo> {
    const role = await this.findByUid(uid);
    return this.roleAssembler.toDetailVo(role);
  }

  /** 分页查询角色。 */
  async list(dto: ListRoleDto): Promise<PageResultVo<RoleVo>> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 10;

    const where = dto.keyword
      ? [{ code: Like(`%${dto.keyword}%`) }, { name: Like(`%${dto.keyword}%`) }]
      : {};

    const [items, total] = await this.roleRepository.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return createPageResult(RoleMapper.toVoArray(items), total, page, pageSize);
  }

  /**
   * 删除角色（系统内置角色禁止删除）。
   *
   * 在单个事务内同时：软删除角色本身，并清理 user_roles / role_permissions /
   * role_menus 中该角色的全部关联行（关联表为显式 join 表，硬删除即可）。
   * 删除前先收集受影响用户，提交后失效其权限码缓存。
   */
  async remove(uid: string): Promise<void> {
    const role = await this.findByUid(uid);
    if (role.isSystem) {
      throw new BusinessException(AccessErrorCode.RBAC_ROLE_IS_SYSTEM, { uid });
    }

    // 先收集受该角色影响的用户，便于事务提交后失效缓存。
    const affectedUserRoles = await this.userRoleRepository.find({
      where: { roleId: role.uid },
    });
    const affectedUserIds = Array.from(
      new Set(affectedUserRoles.map((ur) => ur.userId)),
    );

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(UserRole, { roleId: role.uid });
      await manager.delete(RolePermission, { roleId: role.uid });
      await manager.delete(RoleMenu, { roleId: role.uid });
      await manager.softRemove(role);
    });

    // 事务提交后失效相关用户权限缓存（best-effort）。
    await Promise.all(
      affectedUserIds.map((userId) => this.invalidateUserPerms(userId)),
    );
  }

  /** 为角色分配权限（全量替换）。 */
  async assignPermissions(
    roleUid: string,
    dto: AssignPermissionsDto,
  ): Promise<void> {
    const role = await this.findByUid(roleUid);
    const permissions = await this.permissionService.resolveUidsToIds(
      dto.permissionUids,
    );

    // 在单个事务内「先删旧绑定再写新绑定」，避免 delete 后 save 失败留下空授权。
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(RolePermission, { roleId: role.uid });
      if (permissions.length) {
        const rows = permissions.map((p) =>
          manager.create(RolePermission, {
            roleId: role.uid,
            permissionId: p.uid,
          }),
        );
        await manager.save(rows);
      }
    });

    await this.invalidateRolePerms(role.uid);
  }

  /** 为角色分配菜单（全量替换）。 */
  async assignMenus(roleUid: string, dto: AssignMenusDto): Promise<void> {
    const role = await this.findByUid(roleUid);
    const uniqueMenuUids = Array.from(new Set(dto.menuUids));

    // 在单个事务内「先删旧绑定再写新绑定」，避免 delete 后 save 失败留下空授权。
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(RoleMenu, { roleId: role.uid });
      if (uniqueMenuUids.length) {
        const rows = uniqueMenuUids.map((menuUid) =>
          manager.create(RoleMenu, {
            roleId: role.uid,
            menuId: menuUid,
          }),
        );
        await manager.save(rows);
      }
    });
  }

  /**
   * 为用户分配角色（全量替换该用户的角色绑定）。
   *
   * 写入前用 In 查询校验传入的 roleUids 全部真实存在（未软删），
   * 存在不存在的 uid 则抛 RBAC_ROLE_NOT_FOUND。
   */
  async assignRolesToUser(userId: string, dto: AssignRolesDto): Promise<void> {
    const uniqueRoleUids = Array.from(new Set(dto.roleUids));

    if (uniqueRoleUids.length) {
      const existing = await this.roleRepository.find({
        where: { uid: In(uniqueRoleUids) },
        select: ['uid'],
      });
      const existingUids = new Set(existing.map((r) => r.uid));
      const missing = uniqueRoleUids.filter((uid) => !existingUids.has(uid));
      if (missing.length) {
        throw new BusinessException(AccessErrorCode.RBAC_ROLE_NOT_FOUND, {
          uid: missing.join(','),
        });
      }
    }

    // 在单个事务内「先删旧绑定再写新绑定」，避免 delete 后 save 失败留下空授权。
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(UserRole, { userId });
      if (uniqueRoleUids.length) {
        const rows = uniqueRoleUids.map((roleUid) =>
          manager.create(UserRole, { userId, roleId: roleUid }),
        );
        await manager.save(rows);
      }
    });

    await this.invalidateUserPerms(userId);
  }

  /**
   * 获取用户所拥有的「有效」角色 uid 列表。
   *
   * 仅返回未软删（deletedAt IS NULL）且已启用（enabled = true）的角色，
   * 失效/禁用角色在权限聚合时被忽略。
   */
  async getRoleUidsForUser(userId: string): Promise<string[]> {
    const rows = await this.userRoleRepository
      .createQueryBuilder('ur')
      .innerJoin(
        Role,
        'r',
        'r.uid = ur.role_id AND r.deleted_at IS NULL AND r.enabled = :enabled',
        { enabled: true },
      )
      .where('ur.user_id = :userId', { userId })
      .select('ur.role_id', 'roleId')
      .getRawMany<{ roleId: string }>();
    return Array.from(new Set(rows.map((r) => r.roleId)));
  }

  /** 获取用户可见的菜单 uid 列表（去重）。 */
  async getMenuUidsForUser(userId: string): Promise<string[]> {
    const roleUids = await this.getRoleUidsForUser(userId);
    if (!roleUids.length) return [];

    const roleMenus = await this.roleMenuRepository.find({
      where: { roleId: In(roleUids) },
    });
    return Array.from(new Set(roleMenus.map((rm) => rm.menuId)));
  }

  /**
   * 获取用户拥有的权限码列表（经缓存）。
   *
   * 缓存键 `user-perms:${userId}`，命名空间 RBAC_CACHE.NAMESPACE，
   * TTL RBAC_CACHE.USER_PERMS_TTL。
   */
  async getPermissionCodesForUser(userId: string): Promise<string[]> {
    return this.cacheService.getOrSet<string[]>(
      `user-perms:${userId}`,
      async () => {
        const roleUids = await this.getRoleUidsForUser(userId);
        if (!roleUids.length) return [];

        const rolePermissions = await this.rolePermissionRepository.find({
          where: { roleId: In(roleUids) },
        });
        const permissionUids = Array.from(
          new Set(rolePermissions.map((rp) => rp.permissionId)),
        );
        if (!permissionUids.length) return [];

        const permissions =
          await this.permissionService.resolveUidsToIds(permissionUids);
        return Array.from(new Set(permissions.map((p: Permission) => p.code)));
      },
      RBAC_CACHE.USER_PERMS_TTL,
      RBAC_CACHE.NAMESPACE,
    );
  }

  /**
   * 判断用户是否拥有「有效」的超级管理员角色。
   *
   * 仅统计未软删且已启用的 SUPER_ADMIN 角色绑定。供运行时全权限豁免使用。
   */
  async isSuperAdmin(userId: string): Promise<boolean> {
    const count = await this.userRoleRepository
      .createQueryBuilder('ur')
      .innerJoin(
        Role,
        'r',
        'r.uid = ur.role_id AND r.deleted_at IS NULL AND r.enabled = :enabled AND r.code = :code',
        { enabled: true, code: SUPER_ADMIN_ROLE_CODE },
      )
      .where('ur.user_id = :userId', { userId })
      .getCount();
    return count > 0;
  }

  /**
   * 统计系统内「有效超级管理员」账号数量。
   *
   * 即被授予未软删、已启用的 SUPER_ADMIN 角色的去重用户数。
   * 供「最后一个超管保护」判断使用。
   */
  async countEnabledSuperAdmins(): Promise<number> {
    const rows = await this.userRoleRepository
      .createQueryBuilder('ur')
      .innerJoin(
        Role,
        'r',
        'r.uid = ur.role_id AND r.deleted_at IS NULL AND r.enabled = :enabled AND r.code = :code',
        { enabled: true, code: SUPER_ADMIN_ROLE_CODE },
      )
      .select('DISTINCT ur.user_id', 'userId')
      .getRawMany<{ userId: string }>();
    return rows.length;
  }

  /** 失效单个用户的权限码缓存。 */
  private async invalidateUserPerms(userId: string): Promise<void> {
    await this.cacheService.del(`user-perms:${userId}`, RBAC_CACHE.NAMESPACE);
  }

  /**
   * 角色权限变更后，失效受影响用户的权限码缓存（best-effort）。
   * 逐个删除该角色下用户的缓存键。
   */
  private async invalidateRolePerms(roleUid: string): Promise<void> {
    const userRoles = await this.userRoleRepository.find({
      where: { roleId: roleUid },
    });
    await Promise.all(
      userRoles.map((ur) => this.invalidateUserPerms(ur.userId)),
    );
  }
}
