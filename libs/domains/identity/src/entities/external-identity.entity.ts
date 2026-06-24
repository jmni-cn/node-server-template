/**
 * ExternalIdentity Entity — 第三方身份实体（admin / user 共享）。
 *
 * 记录主体绑定的外部身份（OAuth / SSO / 微信等）。通过 `subjectType` + `userId`
 * 关联到 AdminUser 或 EndUser。同一主体类型 + provider 下 providerUserId 唯一。
 */

import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '@core/database';

@Entity('external_identities')
@Unique(['subjectType', 'provider', 'providerUserId'])
@Index(['subjectType', 'userId'])
export class ExternalIdentity extends BaseEntity {
  static override uidPrefix = 'eid';

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

  @Index()
  @Column({
    type: 'varchar',
    length: 50,
    comment: '身份提供方标识，如 wechat/github',
  })
  provider: string;

  @Column({
    type: 'varchar',
    name: 'provider_user_id',
    length: 255,
    comment: '提供方侧用户唯一标识',
  })
  providerUserId: string;

  @Column({
    type: 'varchar',
    name: 'union_id',
    length: 255,
    nullable: true,
    comment: '提供方 UnionId（跨应用统一标识）',
  })
  unionId: string | null;

  @Column({
    type: 'varchar',
    name: 'provider_nickname',
    length: 64,
    nullable: true,
    comment: 'SSO provider 昵称快照（按 provider 绑定维度）',
  })
  providerNickname: string | null;

  @Column({
    type: 'json',
    nullable: true,
    comment: '提供方返回的原始信息',
  })
  raw: Record<string, unknown> | null;
}
