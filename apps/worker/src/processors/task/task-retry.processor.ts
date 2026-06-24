import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { LoggerService } from '@core/logger';
import {
  BaseQueueProcessor,
  JOB_NAMES,
  QUEUE_NAMES,
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
    private readonly logger: LoggerService,
  ) {
    super();
    this.logger.setContext(TaskRetryProcessor.name);
  }

  private async execute(data: TaskJobData): Promise<void> {
    const { taskUid, type } = data;
    await this.taskService.markRunning(taskUid);
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
