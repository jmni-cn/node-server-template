/**
 * Menu Entity — 菜单实体。
 *
 * 树形菜单/权限点，通过 parentId 自引用形成层级（parentId 引用 Menu.uid）。
 */

import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@core/database';
import { MenuType } from './enums';

@Entity('menus')
export class Menu extends BaseEntity {
  static override uidPrefix = 'menu';

  @Index()
  @Column({
    type: 'varchar',
    name: 'parent_id',
    length: 32,
    nullable: true,
    comment: '父菜单 UID（引用 Menu.uid），顶级节点为 null',
  })
  parentId: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    comment: '菜单名称',
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '路由路径',
  })
  path: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '图标标识',
  })
  icon: string | null;

  @Column({
    type: 'int',
    default: 0,
    comment: '排序值（越小越靠前）',
  })
  sort: number;

  @Column({
    type: 'enum',
    enum: MenuType,
    default: MenuType.MENU,
    comment: '菜单类型：directory/menu/button',
  })
  type: MenuType;
}
