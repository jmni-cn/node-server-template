/**
 * RoleAssembler — 角色详情组装器。
 *
 * 通过显式 join 表（RolePermission / RoleMenu）加载角色关联的权限与菜单，
 * 解析对应实体后映射为 RoleDetailVo。
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { Menu } from '../entities/menu.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { RoleMenu } from '../entities/role-menu.entity';

import { RoleMapper } from '../mapper/role.mapper';
import { PermissionMapper } from '../mapper/permission.mapper';
import { MenuMapper } from '../mapper/menu.mapper';
import { RoleDetailVo } from '../vo/role.vo';

@Injectable()
export class RoleAssembler {
  constructor(
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
    @InjectRepository(RoleMenu)
    private readonly roleMenuRepository: Repository<RoleMenu>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
  ) {}

  /** 组装角色详情（含权限与菜单）。 */
  async toDetailVo(role: Role): Promise<RoleDetailVo> {
    const [rolePermissions, roleMenus] = await Promise.all([
      this.rolePermissionRepository.find({ where: { roleId: role.uid } }),
      this.roleMenuRepository.find({ where: { roleId: role.uid } }),
    ]);

    const permissionUids = rolePermissions.map((rp) => rp.permissionId);
    const menuUids = roleMenus.map((rm) => rm.menuId);

    const [permissions, menus] = await Promise.all([
      permissionUids.length
        ? this.permissionRepository.find({ where: { uid: In(permissionUids) } })
        : Promise.resolve([] as Permission[]),
      menuUids.length
        ? this.menuRepository.find({ where: { uid: In(menuUids) } })
        : Promise.resolve([] as Menu[]),
    ]);

    return {
      ...RoleMapper.toVo(role),
      permissions: PermissionMapper.toVoArray(permissions),
      menus: MenuMapper.toVoArray(menus),
    };
  }
}
