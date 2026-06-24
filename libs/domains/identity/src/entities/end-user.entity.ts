/**
 * EndUser Entity — 终端用户主体实体。
 *
 * 仅供 user-api 使用，承载注册 / 登录的 C 端账号。
 * 凭证 / 会话 / 安全事件 / 外部身份等卫星表通过 subjectType='user' 关联，
 * 资料（UserProfile）一对一关联本表 uid。
 */

import { Column, Entity } from 'typeorm';
import { BaseEntity } from '@core/database';
import { UserStatus } from './user-status.enum';

@Entity('end_users')
export class EndUser extends BaseEntity {
  static override uidPrefix = 'eusr';

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
    nullable: true,
    comment: '用户名',
  })
  username: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
    nullable: true,
    comment: '邮箱',
  })
  email: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    unique: true,
    nullable: true,
    comment: '手机号',
  })
  phone: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: '展示昵称（用户可改）',
  })
  nickname: string | null;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
    comment: '用户状态: active/disabled/locked/banned',
  })
  status: UserStatus;

  @Column({
    type: 'int',
    name: 'password_version',
    default: 0,
    comment: 'pv：改密递增使旧 token 失效',
  })
  passwordVersion: number;

  @Column({
    type: 'datetime',
    name: 'last_login_at',
    precision: 6,
    nullable: true,
    comment: '最后登录时间 (UTC)',
  })
  lastLoginAt: Date | null;

  @Column({
    type: 'varchar',
    name: 'last_login_ip',
    length: 45,
    nullable: true,
    comment: '最后登录 IP',
  })
  lastLoginIp: string | null;

  // ↓↓↓ 业务可扩展字段写在这里 ↓↓↓
  // 例如：实名信息、会员等级、积分、来源渠道等业务字段。
  // ↑↑↑ 业务可扩展字段写在这里 ↑↑↑
}
