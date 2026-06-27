import { Injectable } from '@nestjs/common';
import { LoggerService } from '@core/logger';
import { TaskRetentionService } from '@platform/task';
import type { BaseJobData } from '@platform/queue';

/**
 * 任务清理处理器。
 *
 * 注意：清理类 job 走 SYSTEM 队列，而 SYSTEM 队列的 WorkerHost 由
 * {@link SystemMaintenanceProcessor} 持有（每队列单 WorkerHost）。本类不带
 * `@Processor`，作为可注入协作者，由 SystemMaintenanceProcessor 委托调用。
 *
 * 调用 {@link TaskRetentionService.cleanupTerminalTasks} 软删除超过保留期的终态任务
 * （SUCCESS / FAILED / CANCELLED / SKIPPED），不在 worker 直接操作仓储。
 */
@Injectable()
export class TaskCleanupProcessor {
  constructor(
    private readonly retention: TaskRetentionService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(TaskCleanupProcessor.name);
  }

  async handle(data: BaseJobData): Promise<void> {
    const result = await this.retention.cleanupTerminalTasks();
    this.logger.log('Task cleanup processed', {
      requestId: data.requestId ?? null,
      matchedCount: result.matchedCount,
      cleanedCount: result.cleanedCount,
      successCleaned: result.successCleaned,
      failedCleaned: result.failedCleaned,
    });
  }
}
