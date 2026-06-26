/**
 * PermissionService — 权限服务。
 *
 * 管理权限点的增改、查询、分组聚合，以及 uid → 实体的批量解析。
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Like, Repository } from 'typeorm';
import {
  BusinessException,
  PageResultVo,
  createPageResult,
} from '@core/common';

import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import { UpdatePermissionDto } from '../dto/update-permission.dto';
import { ListPermissionDto } from '../dto/list-permission.dto';
import { PermissionVo, PermissionGroupVo } from '../vo/permission.vo';
import { PermissionMapper } from '../mapper/permission.mapper';
import { AccessErrorCode } from '../constants/access-error-codes';

@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    private readonly dataSource: DataSource,
  ) {}

  /** 创建权限（编码唯一）。 */
  async create(dto: CreatePermissionDto): Promise<PermissionVo> {
    const exists = await this.permissionRepository.findOne({
      where: { code: dto.code },
    });
    if (exists) {
      throw new BusinessException(AccessErrorCode.RBAC_PERMISSION_CODE_TAKEN, {
        code: dto.code,
      });
    }

    const permission = this.permissionRepository.create({
      code: dto.code,
      name: dto.name,
      group: dto.group ?? 'default',
    });
    const saved = await this.permissionRepository.save(permission);
    return PermissionMapper.toVo(saved);
  }

  /** 更新权限（名称/分组）。 */
  async update(uid: string, dto: UpdatePermissionDto): Promise<PermissionVo> {
    const permission = await this.findByUid(uid);
    if (dto.name !== undefined) permission.name = dto.name;
    if (dto.group !== undefined) permission.group = dto.group;
    const saved = await this.permissionRepository.save(permission);
    return PermissionMapper.toVo(saved);
  }

  /**
   * 删除权限点。
   *
   * 在事务内先清理 role_permissions 中对该权限的全部授权行，再软删权限本身，
   * 避免遗留悬空授权。
   *
   * 注意：用户权限码缓存（user-perms:*）按 TTL 过期，删除后短暂窗口内仍可能
   * 命中旧缓存；如需即时生效可由调用方触发角色权限重分配以失效缓存。
   */
  async remove(uid: string): Promise<void> {
    const permission = await this.findByUid(uid);
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(RolePermission, { permissionId: permission.uid });
      await manager.softRemove(permission);
    });
  }

  /** 按 uid 查询权限实体（不存在抛 RBAC_PERMISSION_NOT_FOUND）。 */
  async findByUid(uid: string): Promise<Permission> {
    const permission = await this.permissionRepository.findOne({
      where: { uid },
    });
    if (!permission) {
      throw new BusinessException(AccessErrorCode.RBAC_PERMISSION_NOT_FOUND, {
        uid,
      });
    }
    return permission;
  }

  /** 分页查询权限。 */
  async list(dto: ListPermissionDto): Promise<PageResultVo<PermissionVo>> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 10;

    const where: Record<string, unknown> = {};
    if (dto.group) where.group = dto.group;
    if (dto.keyword) where.name = Like(`%${dto.keyword}%`);

    const [items, total] = await this.permissionRepository.findAndCount({
      where,
      order: { group: 'ASC', id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return createPageResult(
      PermissionMapper.toVoArray(items),
      total,
      page,
      pageSize,
    );
  }

  /** 按分组聚合全部权限。 */
  async groupTree(): Promise<PermissionGroupVo[]> {
    const permissions = await this.permissionRepository.find({
      order: { group: 'ASC', id: 'ASC' },
    });

    const byGroup = new Map<string, PermissionVo[]>();
    for (const permission of permissions) {
      const list = byGroup.get(permission.group) ?? [];
      list.push(PermissionMapper.toVo(permission));
      byGroup.set(permission.group, list);
    }

    return Array.from(byGroup.entries()).map(([group, perms]) => ({
      group,
      permissions: perms,
    }));
  }

  /** 将权限 uid 列表解析为权限实体列表。 */
  async resolveUidsToIds(uids: string[]): Promise<Permission[]> {
    if (!uids.length) return [];
    return this.permissionRepository.find({ where: { uid: In(uids) } });
  }
}
