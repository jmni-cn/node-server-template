/**
 * MenuService — 菜单服务。
 *
 * 负责菜单 CRUD、整树查询，以及按用户角色解析其可见菜单树。
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BusinessException } from '@core/common';

import { Menu } from '../entities/menu.entity';
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
    private readonly roleService: RoleService,
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

  /** 删除菜单。 */
  async remove(uid: string): Promise<void> {
    const menu = await this.findByUid(uid);
    await this.menuRepository.softRemove(menu);
  }

  /** 全部菜单的树形结构。 */
  async tree(): Promise<MenuTreeVo[]> {
    const menus = await this.menuRepository.find();
    return MenuMapper.buildTree(menus);
  }

  /** 用户可见菜单树（按其角色授权的菜单解析）。 */
  async menusForUser(userId: string): Promise<MenuTreeVo[]> {
    const menuUids = await this.roleService.getMenuUidsForUser(userId);
    if (!menuUids.length) return [];

    const menus = await this.menuRepository.find({
      where: { uid: In(menuUids) },
    });
    return MenuMapper.buildTree(menus);
  }
}
