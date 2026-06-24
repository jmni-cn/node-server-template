/**
 * RoleService — 角色服务。
 *
 * 负责角色 CRUD、权限/菜单授权、用户角色分配，以及用户权限码/菜单的解析。
 * 用户权限码查询经 CacheService 缓存，授权变更时失效相关缓存。
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
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
    const saved = await this.roleRepository.save(role);
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

  /** 删除角色（系统内置角色禁止删除）。 */
  async remove(uid: string): Promise<void> {
    const role = await this.findByUid(uid);
    if (role.isSystem) {
      throw new BusinessException(AccessErrorCode.RBAC_ROLE_IS_SYSTEM, { uid });
    }
    await this.roleRepository.softRemove(role);
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

    await this.rolePermissionRepository.delete({ roleId: role.uid });
    if (permissions.length) {
      const rows = permissions.map((p) =>
        this.rolePermissionRepository.create({
          roleId: role.uid,
          permissionId: p.uid,
        }),
      );
      await this.rolePermissionRepository.save(rows);
    }

    await this.invalidateRolePerms(role.uid);
  }

  /** 为角色分配菜单（全量替换）。 */
  async assignMenus(roleUid: string, dto: AssignMenusDto): Promise<void> {
    const role = await this.findByUid(roleUid);

    await this.roleMenuRepository.delete({ roleId: role.uid });
    const uniqueMenuUids = Array.from(new Set(dto.menuUids));
    if (uniqueMenuUids.length) {
      const rows = uniqueMenuUids.map((menuUid) =>
        this.roleMenuRepository.create({
          roleId: role.uid,
          menuId: menuUid,
        }),
      );
      await this.roleMenuRepository.save(rows);
    }
  }

  /** 为用户分配角色（全量替换该用户的角色绑定）。 */
  async assignRolesToUser(userId: string, dto: AssignRolesDto): Promise<void> {
    await this.userRoleRepository.delete({ userId });
    const uniqueRoleUids = Array.from(new Set(dto.roleUids));
    if (uniqueRoleUids.length) {
      const rows = uniqueRoleUids.map((roleUid) =>
        this.userRoleRepository.create({ userId, roleId: roleUid }),
      );
      await this.userRoleRepository.save(rows);
    }

    await this.invalidateUserPerms(userId);
  }

  /** 获取用户所拥有的角色 uid 列表。 */
  async getRoleUidsForUser(userId: string): Promise<string[]> {
    const rows = await this.userRoleRepository.find({ where: { userId } });
    return rows.map((r) => r.roleId);
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
