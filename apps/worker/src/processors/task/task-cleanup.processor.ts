import { Injectable } from '@nestjs/common';
import { LoggerService } from '@core/logger';
import type { BaseJobData } from '@platform/queue';

/**
 * 任务清理处理器。
 *
 * 注意：清理类 job 走 SYSTEM 队列，而 SYSTEM 队列的 WorkerHost 由
 * {@link SystemMaintenanceProcessor} 持有（每队列单 WorkerHost）。本类不带
 * `@Processor`，作为可注入协作者，由 SystemMaintenanceProcessor 委托调用。
 *
 * 本模板做日志占位：真实项目可在此清理过期任务/任务日志（应在 @platform/task
 * 暴露对应的删除服务后调用，而非在 app/worker 直接操作仓储）。
 */
@Injectable()
export class TaskCleanupProcessor {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext(TaskCleanupProcessor.name);
  }

  handle(data: BaseJobData): Promise<void> {
    this.logger.log('Task cleanup processed', {
      requestId: data.requestId ?? null,
    });
    // 模板占位：真实清理逻辑接入后改回 async 并 await 对应服务。
    return Promise.resolve();
  }
}
