/**
 * MenuService — 菜单服务。
 *
 * 负责菜单 CRUD、整树查询，以及按用户角色解析其可见菜单树。
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BusinessException } from '@core/common';

import { Menu } from '../entities/menu.entity';
import { RoleMenu } from '../entities/role-menu.entity';
import { MenuType } from '../entities/enums';
import { CreateMenuDto } from '../dto/create-menu.dto';
import { UpdateMenuDto } from '../dto/update-menu.dto';
import { MenuVo, MenuTreeVo } from '../vo/menu.vo';
import { MenuMapper } from '../mapper/menu.mapper';
import { RoleService } from './role.service';
import { AccessErrorCode } from '../constants/access-error-codes';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    @InjectRepository(RoleMenu)
    private readonly roleMenuRepository: Repository<RoleMenu>,
    private readonly roleService: RoleService,
    private readonly dataSource: DataSource,
  ) {}

  /** 创建菜单。 */
  async create(dto: CreateMenuDto): Promise<MenuVo> {
    const menu = this.menuRepository.create({
      parentId: dto.parentId ?? null,
      name: dto.name,
      path: dto.path ?? null,
      icon: dto.icon ?? null,
      sort: dto.sort ?? 0,
      type: dto.type ?? MenuType.MENU,
    });
    const saved = await this.menuRepository.save(menu);
    return MenuMapper.toVo(saved);
  }

  /** 更新菜单。 */
  async update(uid: string, dto: UpdateMenuDto): Promise<MenuVo> {
    const menu = await this.findByUid(uid);
    if (dto.parentId !== undefined) menu.parentId = dto.parentId ?? null;
    if (dto.name !== undefined) menu.name = dto.name;
    if (dto.path !== undefined) menu.path = dto.path ?? null;
    if (dto.icon !== undefined) menu.icon = dto.icon ?? null;
    if (dto.sort !== undefined) menu.sort = dto.sort;
    if (dto.type !== undefined) menu.type = dto.type;
    const saved = await this.menuRepository.save(menu);
    return MenuMapper.toVo(saved);
  }

  /** 按 uid 查询菜单实体（不存在抛 RBAC_MENU_NOT_FOUND）。 */
  async findByUid(uid: string): Promise<Menu> {
    const menu = await this.menuRepository.findOne({ where: { uid } });
    if (!menu) {
      throw new BusinessException(AccessErrorCode.RBAC_MENU_NOT_FOUND, { uid });
    }
    return menu;
  }

  /**
   * 删除菜单。
   *
   * 存在子菜单时拒绝删除（抛 RBAC_MENU_HAS_CHILDREN），避免产生孤儿节点；
   * 在事务内软删除菜单本身，并清理 role_menus 中对该菜单的全部授权行。
   */
  async remove(uid: string): Promise<void> {
    const menu = await this.findByUid(uid);

    const childCount = await this.menuRepository.count({
      where: { parentId: menu.uid },
    });
    if (childCount > 0) {
      throw new BusinessException(AccessErrorCode.RBAC_MENU_HAS_CHILDREN, {
        uid,
        childCount,
      });
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(RoleMenu, { menuId: menu.uid });
      await manager.softRemove(menu);
    });
  }

  /** 全部菜单的树形结构。 */
  async tree(): Promise<MenuTreeVo[]> {
    const menus = await this.menuRepository.find();
    return MenuMapper.buildTree(menus);
  }

  /**
   * 用户可见菜单树（按其角色授权的菜单解析）。
   *
   * 直接被授权的菜单可能缺少未授权的祖先目录，若仅查授权节点会导致叶子被
   * buildTree 当作顶级节点。此处在授权集合基础上向上补全所有祖先节点，
   * 保证树形层级完整。
   */
  async menusForUser(userId: string): Promise<MenuTreeVo[]> {
    const grantedUids = await this.roleService.getMenuUidsForUser(userId);
    if (!grantedUids.length) return [];

    // 一次性加载全部菜单，便于在内存中向上回溯祖先（菜单总量通常较小）。
    const allMenus = await this.menuRepository.find();
    const menuByUid = new Map<string, Menu>(allMenus.map((m) => [m.uid, m]));

    // 从授权节点向上补全祖先，得到完整的可见节点集合。
    const visibleUids = new Set<string>();
    for (const uid of grantedUids) {
      let cursor: string | null | undefined = uid;
      while (cursor && !visibleUids.has(cursor)) {
        const node = menuByUid.get(cursor);
        if (!node) break;
        visibleUids.add(node.uid);
        cursor = node.parentId;
      }
    }

    const visibleMenus = allMenus.filter((m) => visibleUids.has(m.uid));
    return MenuMapper.buildTree(visibleMenus);
  }
}
