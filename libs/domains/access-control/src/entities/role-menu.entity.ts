/**
 * RoleMenu Entity — 角色-菜单关联实体（显式 join 表）。
 *
 * 由 service 显式维护，不使用 TypeORM ManyToMany 装饰器。
 */

import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '@core/database';

@Entity('role_menus')
@Unique(['roleId', 'menuId'])
export class RoleMenu extends BaseEntity {
  static override uidPrefix = 'rmnu';

  @Index()
  @Column({
    type: 'varchar',
    name: 'role_id',
    length: 32,
    comment: '角色 UID',
  })
  roleId: string;

  @Index()
  @Column({
    type: 'varchar',
    name: 'menu_id',
    length: 32,
    comment: '菜单 UID',
  })
  menuId: string;
}
