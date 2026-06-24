/**
 * UserSession Entity — 用户会话实体。
 *
 * 记录刷新令牌（refresh token）的会话信息，支持令牌轮换、会话列举、
 * 令牌家族（token family）盗用检测与单点登出。
 *
 * 安全模型：
 * - tokenHash：refresh token 明文的 SHA256，落库只存哈希，避免明文泄露与篡改。
 * - tokenFamilyId：同一登录链路的所有轮换会话共享同一 family；检测到旧 RT 重放时，
 *   按 family 撤销整条链路，抵御令牌盗用。
 * - refreshCount：链路内已轮换次数。
 * - revokedReason：撤销原因（rotated / reuse_detected / user_logout /
 *   user_logout_all / password_changed ...）。
 */

import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@core/database';

@Index(['subjectType', 'userId', 'jti'], { unique: true })
@Index(['subjectType', 'tokenFamilyId'])
@Entity('user_sessions')
export class UserSession extends BaseEntity {
  static override uidPrefix = 'ses';

  @Column({
    type: 'varchar',
    name: 'subject_type',
    length: 16,
    comment: '主体类型: admin/user',
  })
  subjectType: string;

  @Index()
  @Column({
    type: 'varchar',
    name: 'user_id',
    length: 32,
    comment: '关联主体 UID（AdminUser/EndUser）',
  })
  userId: string;

  @Index()
  @Column({
    type: 'varchar',
    name: 'refresh_token_id',
    length: 64,
    comment: '刷新令牌标识 (JWT ID)',
  })
  jti: string;

  @Index()
  @Column({
    type: 'varchar',
    name: 'token_family_id',
    length: 36,
    nullable: true,
    comment: '令牌家族 ID（同一登录链路的轮换会话共享）',
  })
  tokenFamilyId: string | null;

  @Column({
    type: 'varchar',
    name: 'token_hash',
    length: 100,
    default: '',
    comment: 'refresh token 明文的 SHA256（仅存哈希）',
  })
  tokenHash: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '设备标识（原始 device 字段，向后兼容）',
  })
  device: string | null;

  @Column({
    type: 'varchar',
    name: 'device_id',
    length: 64,
    nullable: true,
    comment: '设备唯一标识',
  })
  deviceId: string | null;

  @Column({
    type: 'varchar',
    name: 'device_name',
    length: 64,
    nullable: true,
    comment: '设备名称',
  })
  deviceName: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'web',
    comment: '客户端平台: web/ios/android/...',
  })
  platform: string;

  @Column({
    type: 'varchar',
    name: 'app_version',
    length: 32,
    nullable: true,
    comment: '客户端版本',
  })
  appVersion: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: '登录 IP',
  })
  ip: string | null;

  @Column({
    type: 'varchar',
    name: 'user_agent',
    length: 500,
    nullable: true,
    comment: '用户代理原始字符串',
  })
  userAgent: string | null;

  @Column({
    type: 'json',
    nullable: true,
    comment: '地理位置信息',
  })
  geo: Record<string, unknown> | null;

  @Column({
    type: 'json',
    nullable: true,
    comment: '附加元数据',
  })
  meta: Record<string, unknown> | null;

  @Column({
    type: 'int',
    name: 'refresh_count',
    default: 0,
    comment: '令牌家族内已轮换次数',
  })
  refreshCount: number;

  @Column({
    type: 'datetime',
    name: 'last_seen_at',
    precision: 6,
    nullable: true,
    comment: '最后活跃时间 (UTC)',
  })
  lastSeenAt: Date | null;

  @Column({
    type: 'datetime',
    name: 'expires_at',
    precision: 6,
    comment: '过期时间 (UTC)',
  })
  expiresAt: Date;

  @Column({
    type: 'datetime',
    name: 'revoked_at',
    precision: 6,
    nullable: true,
    comment: '吊销时间 (UTC)',
  })
  revokedAt: Date | null;

  @Column({
    type: 'varchar',
    name: 'revoked_reason',
    length: 128,
    nullable: true,
    comment:
      '吊销原因: rotated/reuse_detected/user_logout/password_changed ...',
  })
  revokedReason: string | null;
}
