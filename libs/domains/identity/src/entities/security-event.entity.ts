/**
 * SecurityEvent Entity — 用户安全事件审计实体。
 *
 * 记录与账户安全相关的事件（登录、登出、刷新、令牌盗用、改密等），
 * 用于风控、审计与异常告警。IP 脱敏后存储，UA 仅存哈希，避免存放敏感原文。
 */

import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@core/database';

/** 安全事件类型常量元组。 */
export const SECURITY_EVENT_TYPES = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'LOGOUT_ALL',
  'REFRESH_SUCCESS',
  'REFRESH_REUSE_DETECTED',
  'SESSION_REVOKED',
  'PASSWORD_CHANGED',
  'SSO_STATE_MISMATCH',
  'DEVICE_CREATED',
  'DEVICE_REVOKED',
  'ACCESS_DENIED',
  'EXTERNAL_IDENTITY_LINKED',
  'EXTERNAL_IDENTITY_UNLINKED',
  'ACCOUNT_DISABLED',
] as const;

/** 安全事件类型。 */
export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];

/** 安全事件风险等级。 */
export type SecurityRiskLevel = 'low' | 'medium' | 'high' | 'critical';

@Index(['subjectType', 'userId', 'eventType'])
@Index(['subjectType', 'userId', 'createdAt'])
@Entity('user_security_events')
export class SecurityEvent extends BaseEntity {
  static override uidPrefix = 'sev';

  @Column({
    type: 'varchar',
    name: 'subject_type',
    length: 16,
    nullable: true,
    comment: '主体类型: admin/user（匿名事件可为空）',
  })
  subjectType: string | null;

  @Column({
    type: 'varchar',
    name: 'user_id',
    length: 32,
    nullable: true,
    comment: '关联主体 UID（匿名事件可为空）',
  })
  userId: string | null;

  @Column({
    type: 'varchar',
    name: 'device_id',
    length: 64,
    nullable: true,
    comment: '设备标识',
  })
  deviceId: string | null;

  @Column({
    type: 'varchar',
    name: 'session_uid',
    length: 32,
    nullable: true,
    comment: '关联会话 UID',
  })
  sessionUid: string | null;

  @Column({
    type: 'varchar',
    name: 'event_type',
    length: 64,
    comment: '事件类型',
  })
  eventType: string;

  @Column({
    type: 'varchar',
    name: 'risk_level',
    length: 16,
    default: 'low',
    comment: '风险等级: low/medium/high/critical',
  })
  riskLevel: string;

  @Column({
    type: 'varchar',
    name: 'ip_masked',
    length: 45,
    nullable: true,
    comment: '脱敏后的 IP',
  })
  ipMasked: string | null;

  @Column({
    type: 'varchar',
    name: 'user_agent_hash',
    length: 64,
    nullable: true,
    comment: 'User-Agent 哈希',
  })
  userAgentHash: string | null;

  @Column({
    type: 'json',
    nullable: true,
    comment: '附加元数据',
  })
  metadata: Record<string, unknown> | null;
}
