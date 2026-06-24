/**
 * UserRole Entity — 用户-角色关联实体（显式 join 表）。
 *
 * 由 service 显式维护，不使用 TypeORM ManyToMany 装饰器。
 */

import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '@core/database';

@Entity('user_roles')
@Unique(['userId', 'roleId'])
export class UserRole extends BaseEntity {
  static override uidPrefix = 'urol';

  @Index()
  @Column({
    type: 'varchar',
    name: 'user_id',
    length: 32,
    comment: 'AdminUser uid（角色仅授予后台管理员）',
  })
  userId: string;

  @Index()
  @Column({
    type: 'varchar',
    name: 'role_id',
    length: 32,
    comment: '角色 UID',
  })
  roleId: string;
}
