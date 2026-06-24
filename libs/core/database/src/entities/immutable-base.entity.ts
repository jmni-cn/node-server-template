import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Column,
  BeforeInsert,
  Index,
} from 'typeorm';
import { generatePrefixedUid } from '@core/common';

/**
 * 不可变记录基础实体抽象类
 * 用于版本记录、领取记录、签到记录等只创建不修改的数据
 *
 * 与 BaseEntity 的区别：
 * - 无 updatedAt、updatedBy 字段（记录不可修改）
 * - 无 deletedAt 字段（不支持软删除）
 *
 * 子类必须定义 static uidPrefix，用于生成带业务前缀的 UID。
 * 使用场景：
 * - 版本快照（pageVersion, componentVersion, actionDefVersion, queryVersion）
 * - 业务记录（claim, signin, auditLog）
 * - 不可变日志
 */
export abstract class ImmutableBaseEntity {
  /** 业务前缀，用于 generatePrefixedUid(uidPrefix, 8)，子类必须覆盖 */
  protected static uidPrefix: string = 'imm';

  @PrimaryGeneratedColumn({ type: 'bigint', comment: '主键ID（自增）' })
  id: number;

  @Index()
  @Column({
    type: 'varchar',
    length: 32,
    unique: true,
    comment: '业务UID（含前缀，如 psnap_xxx）',
  })
  uid: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 6,
    comment: '创建时间 (UTC)',
  })
  createdAt: Date;

  @Column({
    type: 'varchar',
    name: 'created_by',
    length: 32,
    nullable: true,
    comment: '创建人UID',
  })
  createdBy: string | null;

  /** 创建人用户名（冗余，便于列表/详情展示与审计快照） */
  @Column({
    type: 'varchar',
    name: 'created_by_username',
    length: 64,
    nullable: true,
    comment: '创建人用户名',
  })
  createdByUsername: string | null;

  @BeforeInsert()
  generateUid() {
    if (!this.uid) {
      const prefix = (this.constructor as typeof ImmutableBaseEntity).uidPrefix;
      this.uid = generatePrefixedUid(prefix, 8);
    }
  }
}
