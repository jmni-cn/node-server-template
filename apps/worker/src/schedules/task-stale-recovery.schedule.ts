import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LoggerService } from '@core/logger';
import { TaskService } from '@platform/task';

/**
 * 卡死任务恢复调度（stale recovery）。
 *
 * 每 ~5min 扫描 PROCESSING 且认领时间（locked_at）早于 stale 阈值的任务（worker 崩溃/
 * 卡死导致长时间未完成），通过 TaskService.recoverStaleTasks 以 CAS 方式重置为
 * RETRYING（尚有重试次数，等待 dispatcher 兜底重投）或 FAILED（重试耗尽）。
 *
 * 阈值/limit 取 TASK_RELIABILITY_DEFAULTS 默认值（service 内部读取）。
 * 调度仅触发恢复扫描，本身不执行任务。
 */
@Injectable()
export class TaskStaleRecoverySchedule {
  constructor(
    private readonly taskService: TaskService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(TaskStaleRecoverySchedule.name);
  }

  // 每 5 分钟执行一次。TODO: 阈值/间隔可后续配置化。
  @Cron(CronExpression.EVERY_5_MINUTES)
  async recoverStale(): Promise<void> {
    const { scanned, retried, failed } =
      await this.taskService.recoverStaleTasks();
    if (retried + failed > 0) {
      this.logger.warn(
        `stale 恢复调度：扫描 ${scanned}，重投 ${retried}，置失败 ${failed}`,
      );
    }
  }
}
