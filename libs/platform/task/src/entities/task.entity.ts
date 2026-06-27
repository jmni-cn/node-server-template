import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '@core/database';
import { TaskStatus } from '../constants';

/**
 * 任务实体（表 `tasks`）——通用富任务引擎。
 *
 * 表示一个可执行、可重试、可调度、可去重、可追踪的异步任务。状态机见 {@link TaskStatus}。
 * 任务类型 `type` 为通用字符串，由调用方传值（模板不内置任何业务枚举）。
 * UID 前缀为 `task`（由 BaseEntity 的 @BeforeInsert 自动生成）。
 *
 * 字段说明：
 * - type: 任务类型（通用字符串，业务含义由调用方定义）。
 * - bizType / bizUid: 业务归属（关联具体业务对象，便于按业务维度检索）。
 * - status: 任务状态。
 * - priority: 优先级（数值越大越优先，调度按 DESC 排序）。
 * - attempt / maxAttempt: 已尝试 / 最大尝试次数（重试机制）。
 * - dedupKey: 幂等键（唯一索引，跨「创建+入队」去重）。
 * - targetVersion / requestedVersion / resolvedVersion: 版本协商字段（灰度 / 版本控制）。
 * - dependsOnTaskUid / blockReason: 任务依赖与阻塞原因。
 * - queueName / workerId: 队列与处理 worker 标识。
 * - scheduledAt / startedAt / finishedAt: 计划 / 开始 / 结束时间。
 * - lockedBy / lockedAt: 认领者标识与认领时间（stale 恢复判定）。
 * - dispatchedAt: 最近一次投递队列时间（派发租约，dispatcher 兜底重投判定）。
 * - inputJson / stagesJson / outputJson: 输入 / 阶段 / 输出数据。
 * - errorCode / errorMessage: 失败错误码与信息。
 * - sourceType: 来源类型（通用字符串，业务含义由调用方定义）。
 * - traceId: 链路追踪 ID。
 * - name: 任务名称（模板兼容字段，可空）。
 */
@Entity('tasks')
@Index('uq_tasks_dedup_key', ['dedupKey'], { unique: true })
@Index('idx_tasks_type_status_scheduled', ['type', 'status', 'scheduledAt'])
@Index('idx_tasks_biz', ['bizType', 'bizUid'])
@Index('idx_tasks_status_priority', ['status', 'priority', 'scheduledAt'])
@Index('idx_tasks_trace', ['traceId'])
export class Task extends BaseEntity {
  protected static override uidPrefix = 'task';

  /**
   * 任务类型（通用字符串，由调用方定义业务含义）。
   * 模板不内置任何业务枚举。
   */
  @Column({ type: 'varchar', length: 100, comment: '任务类型（通用字符串）' })
  type: string;

  /** 业务类型（可空）：细分任务所属业务领域。 */
  @Column({
    type: 'varchar',
    length: 64,
    name: 'biz_type',
    nullable: true,
    comment: '业务类型',
  })
  bizType: string | null;

  /** 业务 UID（可空）：关联具体业务对象。 */
  @Column({
    type: 'varchar',
    length: 64,
    name: 'biz_uid',
    nullable: true,
    comment: '业务 UID',
  })
  bizUid: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    default: TaskStatus.PENDING,
    comment: '任务状态（以小写字符串存储）',
  })
  status: TaskStatus;

  /** 优先级：数值越大越优先（调度按 DESC 排序）。 */
  @Column({ type: 'int', default: 0, comment: '任务优先级（越大越优先）' })
  priority: number;

  /** 已尝试次数。 */
  @Column({ type: 'int', default: 0, comment: '已尝试次数' })
  attempt: number;

  /** 最大尝试次数。 */
  @Column({
    type: 'int',
    name: 'max_attempt',
    default: 3,
    comment: '最大尝试次数',
  })
  maxAttempt: number;

  /**
   * 幂等键（可空，唯一索引）：业务侧用于跨「创建 + 入队」去重。
   *
   * 当不同请求携带相同 dedupKey 时，DB 唯一约束保证只会落库一条任务；
   * 配合入队时设置 jobId 实现跨完成态的队列级去重。NULL 不参与唯一约束冲突
   * （MySQL 唯一索引允许多个 NULL）。
   */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'dedup_key',
    nullable: true,
    comment: '幂等键（唯一，可空）：用于跨创建+入队去重',
  })
  dedupKey: string | null;

  /** 目标版本（可空）：任务期望执行的系统版本（灰度 / 版本控制）。 */
  @Column({
    type: 'varchar',
    length: 128,
    name: 'target_version',
    nullable: true,
    comment: '目标版本',
  })
  targetVersion: string | null;

  /** 请求版本（可空）：任务创建时系统版本。 */
  @Column({
    type: 'varchar',
    length: 128,
    name: 'requested_version',
    nullable: true,
    comment: '请求版本',
  })
  requestedVersion: string | null;

  /** 解析版本（可空）：任务执行过程中解析出的系统版本。 */
  @Column({
    type: 'varchar',
    length: 128,
    name: 'resolved_version',
    nullable: true,
    comment: '解析版本',
  })
  resolvedVersion: string | null;

  /** 依赖任务 UID（可空）：当前任务依赖的其他任务。 */
  @Column({
    type: 'varchar',
    length: 32,
    name: 'depends_on_task_uid',
    nullable: true,
    comment: '依赖任务 UID',
  })
  dependsOnTaskUid: string | null;

  /** 阻塞原因（可空）：如依赖任务未完成。 */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'block_reason',
    nullable: true,
    comment: '阻塞原因',
  })
  blockReason: string | null;

  /** 队列名（可空）：任务所属队列。 */
  @Column({
    type: 'varchar',
    length: 64,
    name: 'queue_name',
    nullable: true,
    comment: '队列名',
  })
  queueName: string | null;

  /** 处理 worker 标识（可空）。 */
  @Column({
    type: 'varchar',
    length: 64,
    name: 'worker_id',
    nullable: true,
    comment: 'Worker 标识',
  })
  workerId: string | null;

  @Column({
    type: 'datetime',
    precision: 6,
    name: 'scheduled_at',
    nullable: true,
    comment: '计划执行时间（UTC）',
  })
  scheduledAt: Date | null;

  @Column({
    type: 'datetime',
    precision: 6,
    name: 'started_at',
    nullable: true,
    comment: '开始执行时间（UTC）',
  })
  startedAt: Date | null;

  @Column({
    type: 'datetime',
    precision: 6,
    name: 'finished_at',
    nullable: true,
    comment: '执行结束时间（UTC）',
  })
  finishedAt: Date | null;

  /**
   * 认领者标识（可空）：worker 认领任务时写入 workerId / hostname，
   * 便于 stale 恢复时排查是哪个 worker 持有但未完成。
   */
  @Column({
    type: 'varchar',
    length: 64,
    name: 'locked_by',
    nullable: true,
    comment: '认领者标识（workerId / hostname）',
  })
  lockedBy: string | null;

  /**
   * 认领时间（可空）：worker 认领任务时写入 NOW()。
   *
   * stale 恢复扫描以此判定 PROCESSING 任务是否「卡死」（lockedAt 早于 now-staleMinutes）。
   */
  @Column({
    type: 'datetime',
    precision: 6,
    name: 'locked_at',
    nullable: true,
    comment: '认领时间（UTC）：用于 stale 卡死任务恢复判定',
  })
  lockedAt: Date | null;

  /**
   * 已投递时间（可空）：直接投递成功或 dispatcher 兜底投递后写入。
   *
   * 用于「PENDING 扫描兜底」判定——dispatcher 仅捞取尚未投递（NULL）或投递已超过
   * 租约宽限期（视为投递可能丢失）的任务，避免对刚入队的任务重复投递。
   */
  @Column({
    type: 'datetime',
    precision: 6,
    name: 'dispatched_at',
    nullable: true,
    comment: '已投递时间（UTC）：直接投递或 dispatcher 兜底投递后写入',
  })
  dispatchedAt: Date | null;

  /** 输入数据（任务负载）。 */
  @Column({
    type: 'json',
    name: 'input_json',
    nullable: true,
    comment: '输入 JSON（任务负载）',
  })
  inputJson: Record<string, unknown> | null;

  /** 阶段数据。 */
  @Column({
    type: 'json',
    name: 'stages_json',
    nullable: true,
    comment: '阶段 JSON',
  })
  stagesJson: Record<string, unknown> | null;

  /** 输出数据。 */
  @Column({
    type: 'json',
    name: 'output_json',
    nullable: true,
    comment: '输出 JSON',
  })
  outputJson: Record<string, unknown> | null;

  /** 失败错误码（可空）。 */
  @Column({
    type: 'varchar',
    length: 64,
    name: 'error_code',
    nullable: true,
    comment: '错误码',
  })
  errorCode: string | null;

  /** 失败错误信息（可空）。 */
  @Column({
    type: 'text',
    name: 'error_message',
    nullable: true,
    comment: '错误信息',
  })
  errorMessage: string | null;

  /**
   * 来源类型（通用字符串，可空）：任务来源，由调用方定义业务含义。
   * 模板不内置任何业务来源枚举。
   */
  @Column({
    type: 'varchar',
    length: 32,
    name: 'source_type',
    nullable: true,
    comment: '来源类型（通用字符串）',
  })
  sourceType: string | null;

  /** 链路追踪 ID（可空）。 */
  @Column({
    type: 'varchar',
    length: 64,
    name: 'trace_id',
    nullable: true,
    comment: '链路追踪 ID',
  })
  traceId: string | null;

  /**
   * 任务名称（可空，模板兼容字段）。
   *
   * CS 来源无此字段；为保留模板原有能力（按名称展示）置为 nullable，
   * 由调用方按需填写。
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '任务名称（可空）',
  })
  name: string | null;
}
