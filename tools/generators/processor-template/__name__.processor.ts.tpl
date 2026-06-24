import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { LoggerService } from '@core/logger';
import { BaseQueueProcessor, QUEUE_NAMES } from '@platform/queue';

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5);

/**
 * __Name__ 队列处理器（worker 单文件生成模板）。
 *
 * 长耗时工作只在 worker 处理器执行。将 QUEUE_NAMES.__NAME__ 与对应 JOB_NAMES
 * 在 @platform/queue 中登记后，在 handlers 中映射 job 名到处理方法。
 */
@Processor(QUEUE_NAMES.__NAME__, { concurrency: CONCURRENCY })
export class __Name__Processor extends BaseQueueProcessor {
  protected handlers = {
    // [JOB_NAMES.__NAME__.SOME_JOB]: (job: Job) => this.handle(job.data),
  };

  constructor(private readonly logger: LoggerService) {
    super();
    this.logger.setContext(__Name__Processor.name);
  }

  private async handle(data: unknown): Promise<void> {
    // TODO: 实现 __name__ 任务处理逻辑。
    this.logger.log('__Name__ job processed');
    void data;
    return Promise.resolve();
  }
}
