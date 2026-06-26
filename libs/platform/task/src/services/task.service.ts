import { hostname } from 'node:os';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { BusinessException } from '@core/common';
import { LoggerService } from '@core/logger';
import { RuntimeConfigService } from '@platform/config';
import { QueueProducer, QUEUE_NAMES, JOB_NAMES } from '@platform/queue';
import type { EnqueueOptions } from '@platform/queue';
import { Task, TaskLog } from '../entities';
import { TaskStatus, TaskErrorCode, TASK_CONFIG_KEYS } from '../constants';
import type { CreateTaskInput } from '../types';

/**
 * 任务核心服务：负责创建、入队、状态流转与日志写入。
 */
@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(TaskLog)
    private readonly logRepo: Repository<TaskLog>,
    private readonly queueProducer: QueueProducer,
    private readonly logger: LoggerService,
    // 运行期配置读取（DB → env → 代码默认，fail-safe，热更新）。
    private readonly runtimeConfig: RuntimeConfigService,
  ) {
    this.logger.setContext(TaskService.name);
  }

  /**
   * 创建任务（状态 PENDING），不入队。
   *
   * 若提供 dedupKey 且已存在同 dedupKey 的任务，则**幂等返回现有任务**（不重复创建）。
   */
  async create(input: CreateTaskInput): Promise<Task> {
    if (input.dedupKey) {
      const existing = await this.taskRepo.findOne({
        where: { dedupKey: input.dedupKey },
      });
      if (existing) {
        return existing;
      }
    }

    const task = this.taskRepo.create({
      name: input.name,
      type: input.type,
      payload: input.payload ?? null,
      status: TaskStatus.PENDING,
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 3,
      scheduledAt: input.scheduledAt ?? null,
      dedupKey: input.dedupKey ?? null,
    });

    try {
      return await this.taskRepo.save(task);
    } catch (err) {
      // 并发兜底：先查后插存在竞态，两个请求可能同时通过上面的 findOne 检查。
      // 命中 dedup_key 唯一约束冲突（MySQL ER_DUP_ENTRY / errno 1062）时，回查并返回
      // 已存在的任务，保持「相同 dedupKey 幂等返回」语义。
      if (input.dedupKey && this.isDuplicateKeyError(err)) {
        const existing = await this.taskRepo.findOne({
          where: { dedupKey: input.dedupKey },
        });
        if (existing) {
          return existing;
        }
      }
      throw err;
    }
  }

  /** 判定是否为 MySQL 唯一约束冲突（ER_DUP_ENTRY / errno 1062）。 */
  private isDuplicateKeyError(err: unknown): boolean {
    const driver =
      err && typeof err === 'object' && 'driverError' in err
        ? (err as { driverError?: unknown }).driverError
        : err;
    if (driver && typeof driver === 'object') {
      const e = driver as { code?: unknown; errno?: unknown };
      return e.code === 'ER_DUP_ENTRY' || e.errno === 1062;
    }
    return false;
  }

  /**
   * 创建任务并入队执行。若 scheduledAt 在未来则按 delay 延迟入队。
   */
  async createAndEnqueue(input: CreateTaskInput): Promise<Task> {
    const task = await this.create(input);

    // jobId 取 task.uid：BullMQ 对相同 jobId 去重（跨完成态），配合 DB dedupKey 双重幂等。
    // attempts/backoff 按任务 maxAttempts 显式设置，避免依赖队列默认值。
    const opts: EnqueueOptions = {
      jobId: task.uid,
      attempts: task.maxAttempts,
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
          payload: input.payload,
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

    // 投递成功后标记 dispatched_at：使直接投递成为快路径，dispatcher（PENDING 扫描）
    // 仅作为入队丢失时的兜底，避免对刚入队的任务重复投递。标记失败不影响主流程
    // （最坏情况下被 dispatcher 在租约宽限期后兜底重投，jobId 去重保证幂等）。
    try {
      await this.markDispatched(task.uid);
    } catch (err) {
      this.logger.warn(
        `标记任务已投递失败（忽略，由 dispatcher 兜底）taskUid=${task.uid}: ${(err as Error).message}`,
      );
    }

    return task;
  }

  /**
   * 按 UID 查找任务，不存在则抛 TASK_NOT_FOUND。
   */
  async findByUid(uid: string): Promise<Task> {
    const task = await this.taskRepo.findOne({ where: { uid } });
    if (!task) {
      throw new BusinessException(TaskErrorCode.TASK_NOT_FOUND, { uid });
    }
    return task;
  }

  /**
   * 更新任务状态，并按状态维护开始/结束时间与错误信息。
   */
  async updateStatus(
    uid: string,
    status: TaskStatus,
    opts?: { error?: string },
  ): Promise<Task> {
    const task = await this.findByUid(uid);
    task.status = status;

    if (status === TaskStatus.RUNNING) {
      task.startedAt = new Date();
    } else if (status === TaskStatus.SUCCESS || status === TaskStatus.FAILED) {
      task.finishedAt = new Date();
    }

    if (opts?.error !== undefined) {
      task.error = opts.error;
    }

    return this.taskRepo.save(task);
  }

  /**
   * 标记任务为运行中，并递增尝试次数（非原子，保留兼容）。
   *
   * @deprecated 多 worker 场景请改用 {@link claim}，以乐观锁避免重复执行。
   */
  async markRunning(uid: string): Promise<Task> {
    const task = await this.findByUid(uid);
    task.status = TaskStatus.RUNNING;
    task.startedAt = new Date();
    task.attempts += 1;
    return this.taskRepo.save(task);
  }

  /**
   * 原子认领任务（乐观锁 CAS）：仅当任务当前处于可运行态（PENDING / RETRYING）时，
   * 才置为 RUNNING、记录 startedAt 并递增 attempts。
   *
   * 通过单条带 status 谓词的 UPDATE 实现：受影响行数为 1 → 认领成功；为 0 → 已被其它
   * worker 抢先认领（或状态已流转），调用方应直接跳过，避免重复执行。
   *
   * 认领成功时一并写入 lockedBy（workerId / hostname）与 lockedAt=NOW()，
   * 供 stale 恢复扫描判定卡死任务（与原有 CAS 合并为同一条 UPDATE）。
   *
   * @param uid      任务 UID
   * @param workerId 认领者标识（缺省取进程 hostname）
   * @returns 认领成功返回 true，否则 false。
   */
  async claim(uid: string, workerId?: string): Promise<boolean> {
    const result = await this.taskRepo
      .createQueryBuilder()
      .update(Task)
      .set({
        status: TaskStatus.RUNNING,
        startedAt: () => 'NOW()',
        attempts: () => 'attempts + 1',
        lockedBy: workerId ?? hostname(),
        lockedAt: () => 'NOW()',
      })
      .where('uid = :uid', { uid })
      .andWhere('status IN (:...claimable)', {
        claimable: [TaskStatus.PENDING, TaskStatus.RETRYING],
      })
      .execute();
    return (result.affected ?? 0) === 1;
  }

  /**
   * 扫描待投递任务（dispatcher 兜底用）。
   *
   * 捞取 status IN (PENDING, RETRYING) 且 dispatched_at 为空，或 dispatched_at 早于
   * now - 租约宽限期（视为直接投递可能丢失）的任务，按 createdAt 升序限量返回。
   * 配合入队 jobId=task.uid 去重，重复投递是幂等的。
   *
   * @param limit 单次最大捞取数（缺省 DISPATCH_SCAN_LIMIT）
   */
  async findPendingForDispatch(limit?: number): Promise<Task[]> {
    // 不传内联默认：getter 未传 defaultValue 时回退到注册表 def.defaultValue，
    // 默认值仅在 TaskModule 的定义注册表里出现一处。
    const take =
      limit ??
      (await this.runtimeConfig.getNumber(
        TASK_CONFIG_KEYS.DISPATCH_SCAN_LIMIT,
      ));
    const graceSeconds = await this.runtimeConfig.getNumber(
      TASK_CONFIG_KEYS.DISPATCH_LEASE_GRACE_SECONDS,
    );
    const threshold = new Date(Date.now() - graceSeconds * 1000);

    return this.taskRepo
      .createQueryBuilder('task')
      .where('task.status IN (:...dispatchable)', {
        dispatchable: [TaskStatus.PENDING, TaskStatus.RETRYING],
      })
      .andWhere(
        '(task.dispatchedAt IS NULL OR task.dispatchedAt < :threshold)',
        { threshold },
      )
      .orderBy('task.createdAt', 'ASC')
      .take(take)
      .getMany();
  }

  /**
   * 标记任务为已投递（CAS）：仅当任务仍处于可投递态（PENDING / RETRYING）时
   * 写入 dispatched_at=NOW()。
   *
   * 用单条带 status 谓词的 UPDATE 实现，避免覆盖已流转（如已被认领为 RUNNING）
   * 任务的状态。
   *
   * @returns 标记成功（受影响 1 行）返回 true，否则 false。
   */
  async markDispatched(uid: string): Promise<boolean> {
    const result = await this.taskRepo
      .createQueryBuilder()
      .update(Task)
      .set({ dispatchedAt: () => 'NOW()' })
      .where('uid = :uid', { uid })
      .andWhere('status IN (:...dispatchable)', {
        dispatchable: [TaskStatus.PENDING, TaskStatus.RETRYING],
      })
      .execute();
    return (result.affected ?? 0) === 1;
  }

  /**
   * 恢复卡死（stale）任务。
   *
   * 扫描 status=RUNNING 且 locked_at 早于 now - staleMinutes 的任务（worker 崩溃/卡死
   * 导致长时间未完成）。对每条任务做 CAS（uid + status=RUNNING + locked_at 不变）：
   * - 尚有剩余尝试次数（attempts < maxAttempts）→ 重置为 RETRYING（清空认领信息与
   *   投递时间，等待 dispatcher 重投）；
   * - 已耗尽尝试次数 → 置为 FAILED，错误码 TASK_STALE_TIMEOUT。
   *
   * CAS 谓词带原 locked_at，避免与「任务恰好在恢复瞬间正常完成/被重新认领」竞态。
   *
   * @returns 实际处理（状态被重置）的任务数。
   */
  async recoverStaleTasks(opts?: {
    staleMinutes?: number;
    limit?: number;
  }): Promise<number> {
    const staleMinutes =
      opts?.staleMinutes ??
      (await this.runtimeConfig.getNumber(
        TASK_CONFIG_KEYS.STALE_MINUTES,
      ));
    const limit =
      opts?.limit ??
      (await this.runtimeConfig.getNumber(
        TASK_CONFIG_KEYS.STALE_SCAN_LIMIT,
      ));
    const threshold = new Date(Date.now() - staleMinutes * 60 * 1000);

    const candidates = await this.taskRepo.find({
      where: {
        status: TaskStatus.RUNNING,
        lockedAt: LessThan(threshold),
      },
      order: { lockedAt: 'ASC' },
      take: limit,
    });

    let recovered = 0;
    for (const task of candidates) {
      const exhausted = task.attempts >= task.maxAttempts;
      const update = this.taskRepo
        .createQueryBuilder()
        .update(Task)
        .where('uid = :uid', { uid: task.uid })
        .andWhere('status = :running', { running: TaskStatus.RUNNING })
        // 带原 locked_at 谓词：任务在扫描后被正常完成/重新认领则 CAS 不命中。
        .andWhere('locked_at = :lockedAt', { lockedAt: task.lockedAt });

      if (exhausted) {
        update.set({
          status: TaskStatus.FAILED,
          finishedAt: () => 'NOW()',
          error: TaskErrorCode.TASK_STALE_TIMEOUT,
        });
      } else {
        update.set({
          status: TaskStatus.RETRYING,
          // 清空认领与投递信息，使 dispatcher 可再次兜底投递。
          lockedBy: null,
          lockedAt: null,
          dispatchedAt: null,
        });
      }

      const result = await update.execute();
      if ((result.affected ?? 0) === 1) {
        recovered += 1;
        this.logger.warn(
          `恢复卡死任务 taskUid=${task.uid} → ${exhausted ? 'FAILED' : 'RETRYING'}`,
          { taskUid: task.uid, attempts: task.attempts, exhausted },
        );
      }
    }

    if (recovered > 0) {
      this.logger.log(`stale 恢复完成，处理 ${recovered} 个卡死任务`);
    }
    return recovered;
  }

  /**
   * 标记任务为成功。
   */
  async markSuccess(uid: string): Promise<Task> {
    return this.updateStatus(uid, TaskStatus.SUCCESS);
  }

  /**
   * 标记任务为失败，并记录错误信息。
   */
  async markFailed(uid: string, error: string): Promise<Task> {
    return this.updateStatus(uid, TaskStatus.FAILED, { error });
  }

  /**
   * 写入一条任务日志。
   */
  async addLog(taskUid: string, level: string, message: string): Promise<void> {
    const log = this.logRepo.create({ taskUid, level, message });
    await this.logRepo.save(log);
  }
}
