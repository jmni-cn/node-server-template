import { Processor, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { LoggerService } from '@core/logger';
import {
  BaseQueueProcessor,
  JOB_NAMES,
  QUEUE_NAMES,
  QueueProducer,
  type TaskJobData,
} from '@platform/queue';
import { TaskService, TaskRetryService } from '@platform/task';

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5);

/**
 * 通用任务处理器：持有 TASK 队列的 WorkerHost，按 job 名分发。
 *
 * - `execute-task` → 执行任务（标记 RUNNING → SUCCESS/FAILED，写任务日志）；
 * - `retry-task`   → 通过 {@link TaskRetryService} 重试失败任务。
 *
 * 本模板对任务执行做通用编排（无具体业务），真实项目应按 `task.type` 分派到
 * 对应的执行器。
 */
@Processor(QUEUE_NAMES.TASK, { concurrency: CONCURRENCY })
export class TaskRetryProcessor extends BaseQueueProcessor {
  protected handlers = {
    [JOB_NAMES.TASK.EXECUTE]: (job: Job) =>
      this.execute(job.data as TaskJobData),
    [JOB_NAMES.TASK.RETRY]: (job: Job) => this.retry(job.data as TaskJobData),
  };

  constructor(
    private readonly taskService: TaskService,
    private readonly taskRetryService: TaskRetryService,
    private readonly queueProducer: QueueProducer,
    private readonly logger: LoggerService,
  ) {
    super();
    this.logger.setContext(TaskRetryProcessor.name);
  }

  /**
   * 失败钩子：当 job 重试次数耗尽（attemptsMade >= opts.attempts）时，
   * 将其转投死信队列（DLQ），避免失败任务被静默丢弃，保留排查 / 重放所需元数据。
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job, err: Error): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      return;
    }
    try {
      await this.queueProducer.enqueueDeadLetter({
        originQueue: job.queueName,
        originJobName: job.name,
        originJobId: job.id ?? null,
        originData: job.data,
        attemptsMade: job.attemptsMade,
        failedReason: err?.message ?? job.failedReason ?? null,
        deadLetteredAt: new Date().toISOString(),
      });
      this.logger.warn('Task job dead-lettered', {
        jobId: job.id,
        jobName: job.name,
        attemptsMade: job.attemptsMade,
      });
    } catch (dlqErr) {
      this.logger.error(
        `转投死信队列失败 jobId=${job.id}: ${(dlqErr as Error).message}`,
      );
    }
  }

  private async execute(data: TaskJobData): Promise<void> {
    const { taskUid, type } = data;
    // 乐观锁原子认领：仅当任务处于可运行态时才认领。认领失败说明已被其它 worker
    // 抢先处理（或状态已流转），直接跳过避免重复执行。
    const claimed = await this.taskService.claim(taskUid);
    if (!claimed) {
      this.logger.warn('Task already claimed by another worker, skip', {
        taskUid,
        type,
      });
      return;
    }
    await this.taskService.addLog(taskUid, 'info', `执行任务 type=${type}`);
    try {
      // 通用占位：真实执行器按 type 分派。此处直接标记成功。
      await this.taskService.markSuccess(taskUid);
      this.logger.log('Task executed', { taskUid, type });
    } catch (err) {
      const message = (err as Error).message;
      await this.taskService.markFailed(taskUid, message);
      await this.taskService.addLog(taskUid, 'error', message);
      throw err;
    }
  }

  private async retry(data: TaskJobData): Promise<void> {
    await this.taskRetryService.retry(data.taskUid);
    this.logger.log('Task retried', { taskUid: data.taskUid });
  }
}
