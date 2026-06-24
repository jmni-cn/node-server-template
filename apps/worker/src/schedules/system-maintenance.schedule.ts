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
 * 系统维护调度：每小时入队一个 SYSTEM 维护（cleanup）job，承接周期性对账/
 * 聚合等系统级任务。本模板复用 SYSTEM.CLEANUP job 名做占位。
 */
@Injectable()
export class SystemMaintenanceSchedule {
  constructor(
    private readonly queueProducer: QueueProducer,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(SystemMaintenanceSchedule.name);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async enqueueMaintenance(): Promise<void> {
    await this.queueProducer.enqueue<BaseJobData>(
      QUEUE_NAMES.SYSTEM,
      JOB_NAMES.SYSTEM.CLEANUP,
      {},
    );
    this.logger.log('Enqueued hourly system maintenance job');
  }
}
