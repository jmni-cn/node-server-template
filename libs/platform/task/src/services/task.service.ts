import { hostname } from 'node:os';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { BusinessException, nowUtc } from '@core/common';
import { LoggerService } from '@core/logger';
import { RuntimeConfigService } from '@platform/config';
import { QueueProducer, QUEUE_NAMES, JOB_NAMES } from '@platform/queue';
import type { EnqueueOptions } from '@platform/queue';
import { Task, TaskLog } from '../entities';
import {
  TaskStatus,
  TaskErrorCode,
  TASK_CONFIG_KEYS,
  CLAIMABLE_STATUSES,
  CANCELLABLE_STATUSES,
  DISPATCHABLE_STATUSES,
} from '../constants';
import type {
  CreateTaskInput,
  TaskListParams,
  TaskOperationContext,
} from '../types';

/**
 * 派发租约宽限期（毫秒）。
 *
 * 在此窗口内刚投递过的任务不会被 dispatcher（{@link findPendingTasks}）重新拾取，
 * 让直接投递（first delivery）有时间被 worker 认领，dispatcher 仅兜底真正滞留的任务。
 */
const DISPATCH_LEASE_GRACE_MS = 30_000;

/** listTasks 允许排序的列白名单（防任意字段排序 / SQL 注入）。 */
const TASK_ALLOWED_SORT_COLUMNS: Record<string, string> = {
  createdAt: 't.created_at',
  updatedAt: 't.updated_at',
  priority: 't.priority',
  status: 't.status',
  scheduledAt: 't.scheduled_at',
  startedAt: 't.started_at',
  finishedAt: 't.finished_at',
};

/**
 * 任务核心服务（通用富任务引擎）。
 *
 * 负责任务的创建、入队、CAS 状态流转（认领 / 完成 / 失败 / 取消 / 重试 / 跳过）、
 * 派发租约与兜底投递、卡死任务自愈、多维查询与日志写入。
 *
 * 任务类型 `type` 为通用字符串，模板不内置任何业务枚举。
 */
@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(TaskLog)
    private readonly logRepo: Repository<TaskLog>,
    private readonly dataSource: DataSource,
    private readonly queueProducer: QueueProducer,
    private readonly logger: LoggerService,
    // 运行期配置读取（DB → env → 代码默认，fail-safe，热更新）。
    private readonly runtimeConfig: RuntimeConfigService,
  ) {
    this.logger.setContext(TaskService.name);
  }

  // ── 创建 ────────────────────────────────────────────────

  /**
   * 创建任务（状态 PENDING），不入队。
   *
   * 若提供 dedupKey 且已存在同 dedupKey 的任务，则**幂等返回现有任务**（不重复创建）。
   * 支持事务上下文：传入 options.manager 时使用该 manager 的 repository。
   */
  async createTask(
    input: CreateTaskInput,
    options?: { manager?: EntityManager },
  ): Promise<Task> {
    const repo = options?.manager
      ? options.manager.getRepository(Task)
      : this.taskRepo;

    if (input.dedupKey) {
      const existing = await repo.findOneBy({ dedupKey: input.dedupKey });
      if (existing) {
        this.logger.log('Task deduplicated, returning existing', {
          dedupKey: input.dedupKey,
          existingUid: existing.uid,
          existingStatus: existing.status,
        });
        return existing;
      }
    }

    const task = repo.create({
      type: input.type,
      name: input.name ?? null,
      bizType: input.bizType ?? null,
      bizUid: input.bizUid ?? null,
      status: TaskStatus.PENDING,
      priority: input.priority ?? 0,
      attempt: 0,
      maxAttempt: input.maxAttempt ?? 3,
      dedupKey: input.dedupKey ?? null,
      targetVersion: input.targetVersion ?? null,
      requestedVersion: input.requestedVersion ?? null,
      dependsOnTaskUid: input.dependsOnTaskUid ?? null,
      queueName: input.queueName ?? null,
      scheduledAt: input.scheduledAt ?? null,
      inputJson: input.inputJson ?? null,
      sourceType: input.sourceType ?? null,
      traceId: input.traceId ?? null,
    });

    // 先查后插非原子 — 并发创建同 dedupKey 时捕获唯一约束冲突并回查返回既有任务。
    let saved: Task;
    try {
      saved = await repo.save(task);
    } catch (err: unknown) {
      if (input.dedupKey && this.isDuplicateKeyError(err)) {
        const existing = await repo.findOneBy({ dedupKey: input.dedupKey });
        if (existing) {
          this.logger.log('Task dedup race resolved via unique constraint', {
            dedupKey: input.dedupKey,
            existingUid: existing.uid,
          });
          return existing;
        }
      }
      throw err;
    }

    this.logger.log('Task created', {
      uid: saved.uid,
      type: saved.type,
      dedupKey: saved.dedupKey,
      bizType: saved.bizType,
      bizUid: saved.bizUid,
    });

    return saved;
  }

  /**
   * 事务上下文内创建任务。委托给 createTask(input, { manager })。
   * 使用传入 manager 的 repository，确保与外部事务一致。
   */
  async createTaskInTransaction(
    manager: EntityManager,
    input: CreateTaskInput,
  ): Promise<Task> {
    return this.createTask(input, { manager });
  }

  /**
   * 创建任务并入队执行。若 scheduledAt 在未来则按 delay 延迟入队。
   *
   * 入队成功后标记 dispatched_at：使直接投递成为快路径，dispatcher（PENDING 扫描）
   * 仅作为入队丢失时的兜底，避免对刚入队的任务重复投递。
   */
  async createAndEnqueue(input: CreateTaskInput): Promise<Task> {
    const task = await this.createTask(input);

    // jobId 取 task.uid：BullMQ 对相同 jobId 去重（跨完成态），配合 DB dedupKey 双重幂等。
    const opts: EnqueueOptions = {
      jobId: task.uid,
      attempts: task.maxAttempt,
      backoff: { type: 'exponential', delay: 1000 },
    };
    if (input.scheduledAt) {
      const delay = input.scheduledAt.getTime() - Date.now();
      if (delay > 0) {
        opts.delay = delay;
      }
    }

    try {
      await this.queueProducer.enqueue(
        QUEUE_NAMES.TASK,
        JOB_NAMES.TASK.EXECUTE,
        {
          taskUid: task.uid,
          type: task.type,
          payload: input.inputJson,
        },
        opts,
      );
    } catch (err) {
      this.logger.error(
        `任务入队失败 taskUid=${task.uid}: ${(err as Error).message}`,
      );
      throw new BusinessException(TaskErrorCode.TASK_ENQUEUE_FAILED, {
        taskUid: task.uid,
      });
    }

    try {
      await this.markDispatched(task.uid);
    } catch (err) {
      this.logger.warn(
        `标记任务已投递失败（忽略，由 dispatcher 兜底）taskUid=${task.uid}: ${(err as Error).message}`,
      );
    }

    return task;
  }

  /** 判定是否为 MySQL 唯一约束冲突（ER_DUP_ENTRY / errno 1062 / 重复键消息）。 */
  private isDuplicateKeyError(err: unknown): boolean {
    const driver =
      err && typeof err === 'object' && 'driverError' in err
        ? (err as { driverError?: unknown }).driverError
        : err;
    if (driver && typeof driver === 'object') {
      const e = driver as { code?: unknown; errno?: unknown; message?: unknown };
      if (e.code === 'ER_DUP_ENTRY' || e.errno === 1062) {
        return true;
      }
      const msg = typeof e.message === 'string' ? e.message : '';
      if (
        msg.includes('ER_DUP_ENTRY') ||
        msg.includes('Duplicate entry') ||
        msg.includes('duplicate key')
      ) {
        return true;
      }
    }
    if (err instanceof Error) {
      const msg = err.message ?? '';
      return (
        msg.includes('ER_DUP_ENTRY') ||
        msg.includes('Duplicate entry') ||
        msg.includes('duplicate key')
      );
    }
    return false;
  }

  // ── CAS 状态流转 ────────────────────────────────────────

  /**
   * 原子认领任务（悲观锁 CAS）：仅当任务处于可认领态（PENDING / RETRYING）时，
   * 置为 PROCESSING、记录 startedAt / lockedBy / lockedAt 并递增 attempt。
   *
   * 任务不存在抛 TASK_NOT_FOUND；状态不可认领抛 TASK_INVALID_STATE。
   * 多 worker 抢占场景应优先使用 {@link tryClaimTask}（抢不到返回 null 而非抛错）。
   */
  async claimTask(uid: string, workerId?: string): Promise<Task> {
    const claimer = workerId ?? hostname();
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Task);

      const task = await repo
        .createQueryBuilder('task')
        .setLock('pessimistic_write')
        .where('task.uid = :uid', { uid })
        .getOne();

      if (!task) {
        throw new BusinessException(TaskErrorCode.TASK_NOT_FOUND, { uid });
      }

      if (!CLAIMABLE_STATUSES.includes(task.status)) {
        throw new BusinessException(TaskErrorCode.TASK_INVALID_STATE, {
          uid,
          status: task.status,
          claimable: CLAIMABLE_STATUSES,
        });
      }

      const now = nowUtc();
      task.status = TaskStatus.PROCESSING;
      task.workerId = claimer;
      task.startedAt = now;
      task.lockedBy = claimer;
      task.lockedAt = now;
      task.attempt += 1;

      await repo.save(task);

      this.logger.log('Task claimed', {
        uid: task.uid,
        workerId: claimer,
        attempt: task.attempt,
      });

      return task;
    });
  }

  /**
   * 幂等抢占：与 {@link claimTask} 相同的 CAS，但当任务不存在、或不在可抢占状态
   * （已被并发/重复投递抢占、或已终态）时返回 null 而非抛 BusinessException。
   *
   * worker processor 应优先使用本方法：抢不到说明该任务已被其它投递处理或已结束，
   * 属于可预期的幂等场景，调用方直接 no-op 返回即可，不应 failTask、不应触发 BullMQ 重试。
   */
  async tryClaimTask(uid: string, workerId?: string): Promise<Task | null> {
    const claimer = workerId ?? hostname();
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Task);

      const task = await repo
        .createQueryBuilder('task')
        .setLock('pessimistic_write')
        .where('task.uid = :uid', { uid })
        .getOne();

      if (!task) {
        this.logger.warn('tryClaimTask: task not found (idempotent skip)', {
          uid,
        });
        return null;
      }

      if (!CLAIMABLE_STATUSES.includes(task.status)) {
        this.logger.log(
          'tryClaimTask: task not claimable (concurrent/duplicate delivery or terminal), idempotent skip',
          { uid, status: task.status },
        );
        return null;
      }

      const now = nowUtc();
      task.status = TaskStatus.PROCESSING;
      task.workerId = claimer;
      task.startedAt = now;
      task.lockedBy = claimer;
      task.lockedAt = now;
      task.attempt += 1;

      await repo.save(task);

      this.logger.log('Task claimed', {
        uid: task.uid,
        workerId: claimer,
        attempt: task.attempt,
      });

      return task;
    });
  }

  /**
   * 标记任务成功（幂等）。
   *
   * 已是 SUCCESS 的重复调用直接返回（BullMQ 重试场景）；仅允许 PROCESSING → SUCCESS，
   * 其它状态抛 TASK_INVALID_STATE。成功时清空认领信息与上一次失败残留的错误字段。
   */
  async completeTask(
    uid: string,
    output?: Record<string, unknown>,
  ): Promise<Task> {
    const task = await this.taskRepo.findOneBy({ uid });
    if (!task) {
      throw new BusinessException(TaskErrorCode.TASK_NOT_FOUND, { uid });
    }

    if (task.status === TaskStatus.SUCCESS) {
      this.logger.debug('completeTask idempotent hit (already SUCCESS)', {
        uid,
      });
      return task;
    }

    if (task.status !== TaskStatus.PROCESSING) {
      throw new BusinessException(TaskErrorCode.TASK_INVALID_STATE, {
        uid,
        status: task.status,
        allowed: TaskStatus.PROCESSING,
      });
    }

    task.status = TaskStatus.SUCCESS;
    task.outputJson = output ?? null;
    task.finishedAt = nowUtc();
    task.lockedBy = null;
    task.lockedAt = null;
    // 清除上一次失败/重试残留的错误字段，避免成功状态显示陈旧错误。
    task.errorCode = null;
    task.errorMessage = null;

    const saved = await this.taskRepo.save(task);
    this.logger.log('Task completed', { uid: saved.uid, type: saved.type });
    return saved;
  }

  /**
   * 标记任务失败（幂等）。
   *
   * 已是 FAILED / RETRYING 的重复调用直接返回；仅允许 PROCESSING → FAILED/RETRYING。
   * 尚有重试次数（attempt < maxAttempt）且非永久错误 → RETRYING；否则 FAILED。
   */
  async failTask(
    uid: string,
    errorCode: string,
    errorMessage: string,
    options?: {
      /** 上游永久性错误（如鉴权失败、参数非法）：不再重试，直接置 FAILED。 */
      nonRetryable?: boolean;
    },
  ): Promise<Task> {
    const task = await this.taskRepo.findOneBy({ uid });
    if (!task) {
      throw new BusinessException(TaskErrorCode.TASK_NOT_FOUND, { uid });
    }

    if (
      task.status === TaskStatus.FAILED ||
      task.status === TaskStatus.RETRYING
    ) {
      this.logger.debug('failTask idempotent hit (already failed/retrying)', {
        uid,
        status: task.status,
      });
      return task;
    }

    if (task.status !== TaskStatus.PROCESSING) {
      throw new BusinessException(TaskErrorCode.TASK_INVALID_STATE, {
        uid,
        status: task.status,
        allowed: TaskStatus.PROCESSING,
      });
    }

    const canRetry = !options?.nonRetryable && task.attempt < task.maxAttempt;
    task.status = canRetry ? TaskStatus.RETRYING : TaskStatus.FAILED;
    task.errorCode = errorCode;
    task.errorMessage = errorMessage;
    task.finishedAt = nowUtc();
    task.lockedBy = null;
    task.lockedAt = null;

    const saved = await this.taskRepo.save(task);
    this.logger.warn('Task failed', {
      uid: saved.uid,
      type: saved.type,
      errorCode,
      attempt: saved.attempt,
      maxAttempt: saved.maxAttempt,
      willRetry: canRetry,
    });
    return saved;
  }

  /**
   * 取消任务：仅允许 PENDING / RETRYING（尚未执行）取消，其它抛 TASK_INVALID_STATE。
   */
  async cancelTask(
    uid: string,
    context?: TaskOperationContext,
  ): Promise<Task> {
    const task = await this.taskRepo.findOneBy({ uid });
    if (!task) {
      throw new BusinessException(TaskErrorCode.TASK_NOT_FOUND, { uid });
    }

    if (!CANCELLABLE_STATUSES.includes(task.status)) {
      throw new BusinessException(TaskErrorCode.TASK_INVALID_STATE, {
        uid,
        status: task.status,
        cancellable: CANCELLABLE_STATUSES,
      });
    }

    task.status = TaskStatus.CANCELLED;
    task.finishedAt = nowUtc();
    if (context?.reason) {
      task.errorMessage = context.reason;
    }

    const saved = await this.taskRepo.save(task);
    this.logger.log('Task cancelled', {
      uid: saved.uid,
      type: saved.type,
      operatorUid: context?.operatorUid,
      reason: context?.reason,
    });
    return saved;
  }

  /**
   * 重试一个失败的任务（悲观锁）。
   *
   * 仅允许 FAILED 状态重试，否则抛 TASK_INVALID_STATE。重置为 PENDING、清零 attempt
   * 与错误/认领信息，由 dispatcher 兜底重新投递（jobId 去重幂等）。
   */
  async retryTask(uid: string, context?: TaskOperationContext): Promise<Task> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Task);

      const task = await repo
        .createQueryBuilder('task')
        .setLock('pessimistic_write')
        .where('task.uid = :uid', { uid })
        .getOne();

      if (!task) {
        throw new BusinessException(TaskErrorCode.TASK_NOT_FOUND, { uid });
      }

      if (task.status !== TaskStatus.FAILED) {
        throw new BusinessException(TaskErrorCode.TASK_INVALID_STATE, {
          uid,
          status: task.status,
          allowed: TaskStatus.FAILED,
        });
      }

      task.status = TaskStatus.PENDING;
      task.attempt = 0;
      task.errorCode = null;
      task.errorMessage = null;
      task.finishedAt = null;
      task.lockedBy = null;
      task.lockedAt = null;
      // 重置投递租约，使 dispatcher 可立即重新兜底投递。
      task.dispatchedAt = null;

      await repo.save(task);

      this.logger.log('Task retried', {
        uid: task.uid,
        type: task.type,
        operatorUid: context?.operatorUid,
        reason: context?.reason,
      });

      return task;
    });
  }

  /**
   * 跳过任务：置为 SKIPPED 终态（人工干预），记录原因。
   */
  async skipTask(uid: string, context?: TaskOperationContext): Promise<Task> {
    const task = await this.taskRepo.findOneBy({ uid });
    if (!task) {
      throw new BusinessException(TaskErrorCode.TASK_NOT_FOUND, { uid });
    }

    task.status = TaskStatus.SKIPPED;
    task.finishedAt = nowUtc();
    if (context?.reason) {
      task.errorMessage = context.reason;
    }

    const saved = await this.taskRepo.save(task);
    this.logger.log('Task skipped', {
      uid: saved.uid,
      type: saved.type,
      operatorUid: context?.operatorUid,
      reason: context?.reason,
    });
    return saved;
  }

  // ── 派发 / 兜底 / 自愈 ──────────────────────────────────

  /**
   * 扫描待投递任务（dispatcher 兜底用）。
   *
   * 捞取指定 type、status IN (PENDING, RETRYING)、scheduledAt 已到期、且未投递或投递
   * 早于派发租约宽限期（视为投递可能丢失）的任务，按 priority DESC、scheduledAt ASC 限量返回。
   */
  async findPendingTasks(type: string, limit: number): Promise<Task[]> {
    const now = nowUtc();
    return this.taskRepo
      .createQueryBuilder('task')
      .where('task.type = :type', { type })
      .andWhere('task.status IN (:...statuses)', {
        statuses: DISPATCHABLE_STATUSES,
      })
      .andWhere('(task.scheduledAt IS NULL OR task.scheduledAt <= :now)', {
        now,
      })
      .andWhere(
        '(task.dispatchedAt IS NULL OR task.dispatchedAt < :leaseThreshold)',
        { leaseThreshold: new Date(now.getTime() - DISPATCH_LEASE_GRACE_MS) },
      )
      .orderBy('task.priority', 'DESC')
      .addOrderBy('task.scheduledAt', 'ASC')
      .take(limit)
      .getMany();
  }

  /**
   * 扫描待投递任务（dispatcher 兜底用，**类型无关**）。
   *
   * 与 {@link findPendingTasks} 不同，本方法不限定 type，捞取所有 status IN
   * (PENDING, RETRYING)、scheduledAt 已到期、且未投递或投递早于派发租约宽限期的任务，
   * 按 priority DESC、createdAt ASC 限量返回。供「全类型兜底投递」调度使用。
   *
   * @param limit 单次最大捞取数（缺省取 DISPATCH_SCAN_LIMIT 运行时配置）。
   */
  async findPendingForDispatch(limit?: number): Promise<Task[]> {
    const take =
      limit ??
      (await this.runtimeConfig.getNumber(
        TASK_CONFIG_KEYS.DISPATCH_SCAN_LIMIT,
      ));
    const now = nowUtc();
    return this.taskRepo
      .createQueryBuilder('task')
      .where('task.status IN (:...statuses)', {
        statuses: DISPATCHABLE_STATUSES,
      })
      .andWhere('(task.scheduledAt IS NULL OR task.scheduledAt <= :now)', {
        now,
      })
      .andWhere(
        '(task.dispatchedAt IS NULL OR task.dispatchedAt < :leaseThreshold)',
        { leaseThreshold: new Date(now.getTime() - DISPATCH_LEASE_GRACE_MS) },
      )
      .orderBy('task.priority', 'DESC')
      .addOrderBy('task.createdAt', 'ASC')
      .take(take)
      .getMany();
  }

  /**
   * 标记任务「已投递队列」，写入派发租约时间戳（dispatched_at=NOW()）。
   *
   * 用单条带 status 谓词的 UPDATE 实现（CAS）：仅当任务仍处于可投递态（PENDING /
   * RETRYING）时写入，绝不覆盖已认领（PROCESSING）/终态任务的状态。
   *
   * @returns 标记成功（受影响 1 行）返回 true，否则 false。
   */
  async markDispatched(uid: string): Promise<boolean> {
    const result = await this.taskRepo
      .createQueryBuilder()
      .update(Task)
      .set({ dispatchedAt: nowUtc() })
      .where('uid = :uid', { uid })
      .andWhere('status IN (:...dispatchable)', {
        dispatchable: DISPATCHABLE_STATUSES,
      })
      .execute();
    return (result.affected ?? 0) === 1;
  }

  /**
   * 恢复卡死（stale）任务 —— worker 崩溃后 task 永久停留在 PROCESSING 的自愈机制。
   *
   * 扫描 status=PROCESSING 且 locked_at 早于 now - staleMinutes 的任务。对每条做 CAS
   * （uid + status=PROCESSING + locked_at 不变，避免与正常完成/重新认领竞态）：
   * - attempt < maxAttempt → 重置为 RETRYING（清认领信息，errorCode=TASK_STALE_RECOVERED，
   *   等待 dispatcher 重投）；
   * - attempt >= maxAttempt → 置 FAILED（errorCode=TASK_STALE_TIMEOUT，管理端可见）。
   *
   * 阈值/limit 缺省取运行时配置（DB → env → 注册表默认）。
   *
   * @returns 扫描数 / 重投数 / 失败数统计。
   */
  async recoverStaleTasks(
    options: { staleMinutes?: number; limit?: number } = {},
  ): Promise<{ scanned: number; retried: number; failed: number }> {
    const staleMinutes =
      options.staleMinutes ??
      (await this.runtimeConfig.getNumber(TASK_CONFIG_KEYS.STALE_MINUTES));
    const limit =
      options.limit ??
      (await this.runtimeConfig.getNumber(TASK_CONFIG_KEYS.STALE_SCAN_LIMIT));
    const threshold = new Date(nowUtc().getTime() - staleMinutes * 60_000);

    const staleTasks = await this.taskRepo
      .createQueryBuilder('task')
      .where('task.status = :status', { status: TaskStatus.PROCESSING })
      .andWhere('task.lockedAt IS NOT NULL')
      .andWhere('task.lockedAt < :threshold', { threshold })
      .orderBy('task.lockedAt', 'ASC')
      .take(limit)
      .getMany();

    let retried = 0;
    let failed = 0;

    for (const task of staleTasks) {
      const canRetry = task.attempt < task.maxAttempt;
      const setClause = canRetry
        ? {
            status: TaskStatus.RETRYING,
            lockedBy: null,
            lockedAt: null,
            dispatchedAt: null,
            errorCode: TaskErrorCode.TASK_STALE_RECOVERED,
            errorMessage: `Stale PROCESSING recovered after ${staleMinutes}min (attempt ${task.attempt}/${task.maxAttempt})`,
          }
        : {
            status: TaskStatus.FAILED,
            lockedBy: null,
            lockedAt: null,
            finishedAt: nowUtc(),
            errorCode: TaskErrorCode.TASK_STALE_TIMEOUT,
            errorMessage: `Stale PROCESSING timed out after ${staleMinutes}min, max attempts exhausted (${task.attempt}/${task.maxAttempt})`,
          };

      const result = await this.taskRepo
        .createQueryBuilder()
        .update(Task)
        .set(setClause)
        .where('uid = :uid', { uid: task.uid })
        .andWhere('status = :status', { status: TaskStatus.PROCESSING })
        .andWhere('locked_at = :lockedAt', { lockedAt: task.lockedAt })
        .execute();

      if ((result.affected ?? 0) > 0) {
        if (canRetry) retried += 1;
        else failed += 1;
        this.logger.warn('Stale task recovered', {
          uid: task.uid,
          type: task.type,
          outcome: canRetry ? 'RETRYING' : 'FAILED',
          attempt: task.attempt,
          maxAttempt: task.maxAttempt,
          lockedBy: task.lockedBy,
        });
      }
    }

    if (staleTasks.length > 0) {
      this.logger.log('Stale task recovery sweep done', {
        scanned: staleTasks.length,
        retried,
        failed,
        staleMinutes,
      });
    }

    return { scanned: staleTasks.length, retried, failed };
  }

  /** 更新任务阶段数据（stages_json），任务不存在抛 TASK_NOT_FOUND。 */
  async updateStages(
    uid: string,
    stagesJson: Record<string, unknown>,
  ): Promise<void> {
    // stages_json 为 json 列，TypeORM 的 QueryDeepPartialEntity 对 Record 类型推断过严，此处显式放宽
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.taskRepo.update({ uid }, { stagesJson } as any);
    if (result.affected === 0) {
      throw new BusinessException(TaskErrorCode.TASK_NOT_FOUND, { uid });
    }
  }

  // ── 查询 ────────────────────────────────────────────────

  /**
   * 多维过滤分页查询任务列表（管理端用）。
   *
   * 返回原始实体元组 [Task[], total]；HTTP 层应经 mapper/assembler 转 VO，不直接返回实体。
   */
  async listTasks(params: TaskListParams): Promise<[Task[], number]> {
    const qb = this.taskRepo
      .createQueryBuilder('t')
      .where('t.deleted_at IS NULL');

    if (params.type) qb.andWhere('t.type = :type', { type: params.type });
    if (params.status)
      qb.andWhere('t.status = :status', { status: params.status });
    if (params.bizType)
      qb.andWhere('t.biz_type = :bizType', { bizType: params.bizType });
    if (params.bizUid)
      qb.andWhere('t.biz_uid = :bizUid', { bizUid: params.bizUid });
    if (params.dedupKey)
      qb.andWhere('t.dedup_key = :dedupKey', { dedupKey: params.dedupKey });
    if (params.lockedBy)
      qb.andWhere('t.locked_by = :lockedBy', { lockedBy: params.lockedBy });
    if (params.createdStartAt)
      qb.andWhere('t.created_at >= :createdStartAt', {
        createdStartAt: params.createdStartAt,
      });
    if (params.createdEndAt)
      qb.andWhere('t.created_at <= :createdEndAt', {
        createdEndAt: params.createdEndAt,
      });
    if (params.updatedStartAt)
      qb.andWhere('t.updated_at >= :updatedStartAt', {
        updatedStartAt: params.updatedStartAt,
      });
    if (params.updatedEndAt)
      qb.andWhere('t.updated_at <= :updatedEndAt', {
        updatedEndAt: params.updatedEndAt,
      });

    const sortCol =
      TASK_ALLOWED_SORT_COLUMNS[params.sortBy ?? ''] ?? 't.created_at';
    const sortDir = params.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(sortCol, sortDir);

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    qb.skip((page - 1) * pageSize).take(pageSize);

    return qb.getManyAndCount();
  }

  /**
   * 按 UID 获取任务，不存在则抛 TASK_NOT_FOUND（管理端要求存在）。
   */
  async getByUid(uid: string): Promise<Task> {
    const task = await this.taskRepo.findOneBy({ uid });
    if (!task) {
      throw new BusinessException(TaskErrorCode.TASK_NOT_FOUND, { uid });
    }
    return task;
  }

  /** 按 UID 查找任务（不存在返回 null）。 */
  async findByUid(uid: string): Promise<Task | null> {
    return this.taskRepo.findOneBy({ uid });
  }

  /** 按幂等键查找任务（不存在返回 null）。 */
  async findByDedupKey(dedupKey: string): Promise<Task | null> {
    return this.taskRepo.findOneBy({ dedupKey });
  }

  /** 列出某业务对象的全部任务（按创建时间倒序）。 */
  async listByBiz(bizType: string, bizUid: string): Promise<Task[]> {
    return this.taskRepo.find({
      where: { bizType, bizUid },
      order: { createdAt: 'DESC' },
    });
  }

  // ── 日志 ────────────────────────────────────────────────

  /** 写入一条任务日志（保留模板能力） */
  async addLog(taskUid: string, level: string, message: string): Promise<void> {
    const log = this.logRepo.create({ taskUid, level, message });
    await this.logRepo.save(log);
  }
}
