/**
 * Permission Entity — 权限实体。
 *
 * 权限点以编码标识（如 rbac:user:read），按分组归类便于管理。
 */

import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@core/database';

@Entity('permissions')
export class Permission extends BaseEntity {
  static override uidPrefix = 'perm';

  @Column({
    type: 'varchar',
    length: 128,
    unique: true,
    comment: '权限编码（唯一），如 rbac:user:read',
  })
  code: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: '权限名称',
  })
  name: string;

  @Index()
  @Column({
    type: 'varchar',
    name: 'perm_group',
    length: 64,
    default: 'default',
    comment: '权限分组',
  })
  group: string;
}
