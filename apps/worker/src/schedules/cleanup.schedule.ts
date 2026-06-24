import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LoggerService } from '@core/logger';
import {
  JOB_NAMES,
  QUEUE_NAMES,
  QueueProducer,
  type BaseJobData,
} from '@platform/queue';

/**
 * 清理调度：每日凌晨入队一个 SYSTEM 清理 job，由
 * {@link SystemMaintenanceProcessor} 委托 TaskCleanupProcessor 执行。
 *
 * 调度本身仅负责入队（不在调度线程内做重活），符合"长任务走队列"约定。
 */
@Injectable()
export class CleanupSchedule {
  constructor(
    private readonly queueProducer: QueueProducer,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(CleanupSchedule.name);
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async enqueueCleanup(): Promise<void> {
    await this.queueProducer.enqueue<BaseJobData>(
      QUEUE_NAMES.SYSTEM,
      JOB_NAMES.SYSTEM.CLEANUP,
      {},
    );
    this.logger.log('Enqueued daily cleanup job');
  }
}
