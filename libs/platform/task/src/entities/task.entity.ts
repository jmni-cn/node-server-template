import { Entity, Column, Index } from 'typeorm';
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

  /**
   * 幂等键（可空，唯一索引）：业务侧用于跨「创建 + 入队」去重。
   *
   * 当不同请求携带相同 dedupKey 时，DB 唯一约束保证只会落库一条任务；
   * 配合入队时设置 jobId 实现跨完成态的队列级去重。NULL 不参与唯一约束冲突
   * （MySQL 唯一索引允许多个 NULL）。
   */
  @Index('uq_tasks_dedup_key', { unique: true })
  @Column({
    type: 'varchar',
    length: 191,
    name: 'dedup_key',
    nullable: true,
    comment: '幂等键（唯一，可空）：用于跨创建+入队去重',
  })
  dedupKey: string | null;

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

  /**
   * 已投递时间（可空）：直接投递成功或 dispatcher 兜底投递后写入。
   *
   * 用于「PENDING 扫描兜底」判定——dispatcher 仅捞取尚未投递（NULL）或投递已超过
   * 租约宽限期（视为投递可能丢失）的任务，避免对刚入队的任务重复投递。
   */
  @Column({
    type: 'datetime',
    name: 'dispatched_at',
    nullable: true,
    comment: '已投递时间（UTC）：直接投递或 dispatcher 兜底投递后写入',
  })
  dispatchedAt: Date | null;

  /**
   * 认领者标识（可空）：worker 认领任务时写入 workerId / hostname，
   * 便于 stale 恢复时排查是哪个 worker 持有但未完成。
   */
  @Column({
    type: 'varchar',
    length: 191,
    name: 'locked_by',
    nullable: true,
    comment: '认领者标识（workerId / hostname）',
  })
  lockedBy: string | null;

  /**
   * 认领时间（可空）：worker 认领任务时写入 NOW()。
   *
   * stale 恢复扫描以此判定 RUNNING 任务是否「卡死」（lockedAt 早于 now-staleMinutes）。
   */
  @Column({
    type: 'datetime',
    name: 'locked_at',
    nullable: true,
    comment: '认领时间（UTC）：用于 stale 卡死任务恢复判定',
  })
  lockedAt: Date | null;
}
