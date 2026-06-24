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
 * 系统生成可变实体基础抽象类
 *
 * 与 BaseEntity 的区别：
 * - 无 createdBy / updatedBy / createdByUsername / updatedByUsername 字段
 *   （系统/定时任务生成的数据没有用户上下文）
 * - 保留 updatedAt（支持 UPSERT 覆盖写入）
 * - 保留 deletedAt（支持软删除）
 *
 * 使用场景：
 * - Worker Cron 定时聚合的统计数据（DailyMetrics, IntentStats, KnowledgeHealth）
 * - 系统自动生成、支持重跑覆盖、无用户归属的记录
 *
 * 子类必须定义 static uidPrefix，用于生成带业务前缀的 UID。
 */
export abstract class SystemBaseEntity {
  /** 业务前缀，用于 generatePrefixedUid(uidPrefix, 8)，子类必须覆盖 */
  protected static uidPrefix: string = 'sys';

  @PrimaryGeneratedColumn({ comment: '主键ID（自增）' })
  id: number;

  @Index()
  @Column({
    type: 'varchar',
    length: 32,
    unique: true,
    comment: '业务UID（含前缀，如 zdm_xxx）',
  })
  uid: string;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', comment: '删除时间（软删除）' })
  deletedAt: Date | null;

  @BeforeInsert()
  generateUid() {
    if (!this.uid) {
      const prefix = (this.constructor as typeof SystemBaseEntity).uidPrefix;
      this.uid = generatePrefixedUid(prefix, 8);
    }
  }
}
