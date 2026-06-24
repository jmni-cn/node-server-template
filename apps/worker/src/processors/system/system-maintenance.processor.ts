import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { LoggerService } from '@core/logger';
import {
  BaseQueueProcessor,
  JOB_NAMES,
  QUEUE_NAMES,
  type BaseJobData,
} from '@platform/queue';
import { TaskCleanupProcessor } from '../task/task-cleanup.processor';

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5);

/**
 * 系统维护处理器：持有 SYSTEM 队列的 WorkerHost，按 job 名分发。
 *
 * - `cleanup` → 委托 {@link TaskCleanupProcessor} 执行清理（过期任务/日志等）。
 *
 * SYSTEM 队列的清理 job 由 {@link CleanupSchedule} 定时入队。
 */
@Processor(QUEUE_NAMES.SYSTEM, { concurrency: CONCURRENCY })
export class SystemMaintenanceProcessor extends BaseQueueProcessor {
  protected handlers = {
    [JOB_NAMES.SYSTEM.CLEANUP]: (job: Job) =>
      this.cleanupProcessor.handle(job.data as BaseJobData),
  };

  constructor(
    private readonly cleanupProcessor: TaskCleanupProcessor,
    private readonly logger: LoggerService,
  ) {
    super();
    this.logger.setContext(SystemMaintenanceProcessor.name);
  }
}
