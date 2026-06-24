/**
 * UserProfile Entity — 终端用户资料实体（END-ONLY）。
 *
 * 仅服务于 EndUser，通过 `userId`（EndUser uid）一对一关联。
 * 管理员（AdminUser）不使用资料表，因此本表不需要 subjectType 判别列。
 */

import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@core/database';

/** 性别。 */
export enum Gender {
  /** 未知 */
  UNKNOWN = 'unknown',
  /** 男 */
  MALE = 'male',
  /** 女 */
  FEMALE = 'female',
}

@Entity('user_profiles')
export class UserProfile extends BaseEntity {
  static override uidPrefix = 'uprf';

  @Index({ unique: true })
  @Column({
    type: 'varchar',
    name: 'user_id',
    length: 32,
    comment: '关联 EndUser UID',
  })
  userId: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: '昵称',
  })
  nickname: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '头像 URL',
  })
  avatar: string | null;

  @Column({
    type: 'enum',
    enum: Gender,
    default: Gender.UNKNOWN,
    comment: '性别: unknown/male/female',
  })
  gender: Gender;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: '个人简介',
  })
  bio: string | null;
}
