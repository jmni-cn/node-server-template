import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { LoggerService } from '@core/logger';
import {
  BaseQueueProcessor,
  JOB_NAMES,
  QUEUE_NAMES,
  type OperationLogJobData,
} from '@platform/queue';
import { OperationLogService } from '@platform/audit';

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5);

/**
 * 审计日志处理器：消费 AUDIT 队列，将操作日志落库。
 *
 * 入队方为 admin-api / user-api 的 OperationLogInterceptor。
 */
@Processor(QUEUE_NAMES.AUDIT, { concurrency: CONCURRENCY })
export class AuditLogProcessor extends BaseQueueProcessor {
  protected handlers = {
    [JOB_NAMES.AUDIT.WRITE_OPERATION_LOG]: (job: Job) =>
      this.write(job.data as OperationLogJobData),
  };

  constructor(
    private readonly operationLogService: OperationLogService,
    private readonly logger: LoggerService,
  ) {
    super();
    this.logger.setContext(AuditLogProcessor.name);
  }

  private async write(data: OperationLogJobData): Promise<void> {
    await this.operationLogService.persistFromJob(data);
    this.logger.log('Operation log persisted', {
      action: data.action,
      module: data.module,
    });
  }
}
