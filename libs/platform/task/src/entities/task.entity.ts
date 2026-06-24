import { Entity, Column } from 'typeorm';
import { BaseEntity } from '@core/database';
import { TaskStatus } from '../constants';

/**
 * 任务实体（表 `tasks`）。
 *
 * 表示一个可执行、可重试的异步任务。状态机见 TaskStatus。
 * UID 前缀为 `task`（由 BaseEntity 的 @BeforeInsert 自动生成）。
 */
@Entity('tasks')
export class Task extends BaseEntity {
  protected static override uidPrefix = 'task';

  @Column({ type: 'varchar', length: 255, comment: '任务名称' })
  name: string;

  @Column({ type: 'varchar', length: 100, comment: '任务类型' })
  type: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: TaskStatus.PENDING,
    comment: '任务状态（以字符串存储）',
  })
  status: TaskStatus;

  @Column({ type: 'json', nullable: true, comment: '任务负载' })
  payload: Record<string, unknown> | null;

  @Column({ type: 'int', default: 0, comment: '已尝试次数' })
  attempts: number;

  @Column({
    type: 'int',
    name: 'max_attempts',
    default: 3,
    comment: '最大尝试次数',
  })
  maxAttempts: number;

  @Column({
    type: 'datetime',
    name: 'scheduled_at',
    nullable: true,
    comment: '计划执行时间',
  })
  scheduledAt: Date | null;

  @Column({
    type: 'datetime',
    name: 'started_at',
    nullable: true,
    comment: '开始执行时间',
  })
  startedAt: Date | null;

  @Column({
    type: 'datetime',
    name: 'finished_at',
    nullable: true,
    comment: '执行结束时间',
  })
  finishedAt: Date | null;

  @Column({ type: 'text', nullable: true, comment: '错误信息' })
  error: string | null;
}
