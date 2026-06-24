/**
 * Role Entity — 角色实体。
 *
 * RBAC 中的角色，承载一组权限与菜单授权，并可分配给用户。
 */

import { Column, Entity } from 'typeorm';
import { BaseEntity } from '@core/database';

@Entity('roles')
export class Role extends BaseEntity {
  static override uidPrefix = 'role';

  @Column({
    type: 'varchar',
    length: 64,
    unique: true,
    comment: '角色编码（唯一），如 admin/editor',
  })
  code: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: '角色名称',
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '角色描述',
  })
  description: string | null;

  @Column({
    type: 'boolean',
    name: 'is_system',
    default: false,
    comment: '是否系统内置角色（内置角色禁止修改/删除）',
  })
  isSystem: boolean;
}
