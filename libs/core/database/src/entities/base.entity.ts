import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Column,
  BeforeInsert,
  Index,
} from 'typeorm';
import { generatePrefixedUid } from '@core/common';

/**
 * 可变实体基础抽象类
 * 包含所有可修改实体共有的字段
 *
 * 使用场景：
 * - 业务实体（User, Role, Permission, Page, Activity, Component...）
 * - 需要支持修改和软删除的数据
 *
 * 子类必须定义 static uidPrefix，用于生成带业务前缀的 UID（如 page_xxx, usr_xxx）。
 * 对于不可变记录（版本快照、领取记录等），请使用 ImmutableBaseEntity
 */
export abstract class BaseEntity {
  /** 业务前缀，用于 generatePrefixedUid(uidPrefix, 8)，子类必须覆盖 */
  protected static uidPrefix: string = 'ent';

  @PrimaryGeneratedColumn({ type: 'bigint', comment: '主键ID（自增）' })
  id: number;

  @Index()
  @Column({
    type: 'varchar',
    length: 32,
    unique: true,
    comment: '业务UID（含前缀，如 page_xxx）',
  })
  uid: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 6,
    comment: '创建时间 (UTC)',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'datetime',
    precision: 6,
    comment: '更新时间 (UTC)',
  })
  updatedAt: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
    comment: '删除时间 (UTC，软删除)',
  })
  deletedAt: Date | null;

  @Column({
    type: 'varchar',
    name: 'created_by',
    length: 32,
    nullable: true,
    comment: '创建人UID',
  })
  createdBy: string | null;

  @Column({
    type: 'varchar',
    name: 'updated_by',
    length: 32,
    nullable: true,
    comment: '更新人UID',
  })
  updatedBy: string | null;

  /** 创建人用户名（冗余，便于列表/详情展示与审计快照） */
  @Column({
    type: 'varchar',
    name: 'created_by_username',
    length: 64,
    nullable: true,
    comment: '创建人用户名',
  })
  createdByUsername: string | null;

  /** 更新人用户名（冗余，便于列表/详情展示与审计快照） */
  @Column({
    type: 'varchar',
    name: 'updated_by_username',
    length: 64,
    nullable: true,
    comment: '更新人用户名',
  })
  updatedByUsername: string | null;

  @BeforeInsert()
  generateUid() {
    if (!this.uid) {
      const prefix = (this.constructor as typeof BaseEntity).uidPrefix;
      this.uid = generatePrefixedUid(prefix, 8);
    }
  }
}
