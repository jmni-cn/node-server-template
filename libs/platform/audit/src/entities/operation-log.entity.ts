/**
 * Operation Log Entity — 操作日志实体。
 *
 * 记录用户操作行为，包含请求信息、客户端信息、地理位置等。
 * 字段命名遵循 JWT/OIDC 标准（sub/jti），并按规范命名 actorId/actorName/status/durationMs。
 */

import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@core/database';

@Entity('operation_logs')
@Index(['module'])
@Index(['action'])
@Index(['actorId'])
@Index(['status'])
export class OperationLog extends BaseEntity {
  static override uidPrefix = 'oplog';

  // ==================== 请求标识 ====================

  @Column({
    type: 'varchar',
    name: 'request_id',
    length: 36,
    nullable: true,
    comment: '请求唯一标识（UUID）',
  })
  requestId: string | null;

  @Column({
    type: 'varchar',
    name: 'session_uid',
    length: 32,
    nullable: true,
    comment: '会话标识 (JWT ID)',
  })
  jti: string | null;

  // ==================== 操作者信息 ====================

  @Column({
    type: 'varchar',
    name: 'actor_id',
    length: 32,
    nullable: true,
    comment: '操作者标识 (Subject)',
  })
  actorId: string | null;

  @Column({
    type: 'varchar',
    name: 'actor_name',
    length: 50,
    nullable: true,
    comment: '操作者名称',
  })
  actorName: string | null;

  // ==================== 请求信息 ====================

  @Column({ type: 'varchar', length: 100, comment: '操作行为' })
  action: string;

  @Column({ type: 'varchar', length: 50, comment: '操作模块' })
  module: string;

  @Column({ type: 'varchar', length: 10, comment: '请求方法' })
  method: string;

  @Column({ type: 'varchar', length: 255, comment: '请求路径' })
  path: string;

  @Column({ type: 'json', nullable: true, comment: '请求参数' })
  params: object | null;

  @Column({ type: 'json', nullable: true, comment: '响应结果' })
  result: object | null;

  // ==================== 客户端信息 ====================

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '请求IP' })
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
    type: 'varchar',
    name: 'device_type',
    length: 20,
    nullable: true,
    comment: '设备类型: desktop/mobile/tablet/bot/unknown',
  })
  deviceType: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: '浏览器名称',
  })
  browser: string | null;

  @Column({
    type: 'varchar',
    name: 'browser_version',
    length: 30,
    nullable: true,
    comment: '浏览器版本',
  })
  browserVersion: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '操作系统' })
  os: string | null;

  @Column({
    type: 'varchar',
    name: 'os_version',
    length: 30,
    nullable: true,
    comment: '操作系统版本',
  })
  osVersion: string | null;

  // ==================== 地理位置 ====================

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '国家' })
  country: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '地区/省份' })
  region: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '城市' })
  city: string | null;

  // ==================== 响应信息 ====================

  @Column({
    type: 'varchar',
    length: 10,
    default: 'success',
    comment: '操作状态: success/failed',
  })
  status: string;

  @Column({
    type: 'varchar',
    name: 'error_code',
    length: 50,
    nullable: true,
    comment: '错误码',
  })
  errorCode: string | null;

  @Column({
    type: 'text',
    name: 'error_message',
    nullable: true,
    comment: '错误信息',
  })
  errorMessage: string | null;

  @Column({
    type: 'int',
    name: 'duration_ms',
    nullable: true,
    comment: '响应耗时（毫秒）',
  })
  durationMs: number | null;
}
