/**
 * AdminUser Entity — 后台管理员主体实体。
 *
 * 仅供 admin-api 使用，承载后台登录账号。字段为模板维护的固定结构，
 * 不应随业务扩展（业务用户字段请放在 EndUser）。
 * 凭证 / 会话 / 安全事件 / 外部身份等卫星表通过 subjectType='admin' 关联。
 */

import { Column, Entity } from 'typeorm';
import { BaseEntity } from '@core/database';
import { UserStatus } from './user-status.enum';

@Entity('admin_users')
export class AdminUser extends BaseEntity {
  static override uidPrefix = 'ausr';

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
    comment: '管理员用户名（登录账号）',
  })
  username: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '邮箱',
  })
  email: string | null;

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
    comment: '账户状态: active/disabled/locked/banned',
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

  @Column({
    type: 'int',
    name: 'failed_login_count',
    default: 0,
    comment: '连续登录失败次数（成功登录后清零）',
  })
  failedLoginCount: number;

  @Column({
    type: 'datetime',
    name: 'locked_until',
    precision: 6,
    nullable: true,
    comment: '账户锁定截止时间 (UTC)；为空或已过期表示未锁定',
  })
  lockedUntil: Date | null;

  @Column({
    type: 'datetime',
    name: 'last_failed_login_at',
    precision: 6,
    nullable: true,
    comment: '最后一次登录失败时间 (UTC)',
  })
  lastFailedLoginAt: Date | null;

  // 说明：admin_users 为模板维护的固定 schema，勿随业务扩展。
}
