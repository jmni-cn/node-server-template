/**
 * UserCredential Entity — 密码凭证实体（admin / user 共享）。
 *
 * 通过 `subjectType` + `userId` 关联到 AdminUser（subjectType='admin'）或
 * EndUser（subjectType='user'）。同一主体下凭证唯一：UNIQUE(subject_type, user_id)。
 */

import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@core/database';

@Index(['subjectType', 'userId'], { unique: true })
@Entity('user_credentials')
export class UserCredential extends BaseEntity {
  static override uidPrefix = 'ucrd';

  @Column({
    type: 'varchar',
    name: 'subject_type',
    length: 16,
    comment: '主体类型: admin/user',
  })
  subjectType: string;

  @Column({
    type: 'varchar',
    name: 'user_id',
    length: 32,
    comment: '关联主体 UID（AdminUser/EndUser）',
  })
  userId: string;

  @Column({
    type: 'varchar',
    name: 'password_hash',
    length: 255,
    comment: '密码哈希',
  })
  passwordHash: string;

  @Column({
    type: 'datetime',
    name: 'password_updated_at',
    precision: 6,
    nullable: true,
    comment: '密码最后更新时间 (UTC)',
  })
  passwordUpdatedAt: Date | null;
}
