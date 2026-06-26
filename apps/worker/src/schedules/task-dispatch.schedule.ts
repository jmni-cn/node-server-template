import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LoggerService } from '@core/logger';
import { JOB_NAMES, QUEUE_NAMES, QueueProducer } from '@platform/queue';
import type { TaskJobData } from '@platform/queue';
import { TaskService } from '@platform/task';

/**
 * 任务投递兜底调度（PENDING 扫描 dispatcher）。
 *
 * 每 ~15s 扫描一批待投递任务（PENDING / RETRYING 且未投递或投递超过租约宽限期），
 * 逐个以 jobId=task.uid 重新入队（BullMQ 对相同 jobId 去重）。
 *
 * 直接投递（TaskService.createAndEnqueue）为快路径并写 dispatched_at；本调度仅作为
 * 入队丢失（如入队后进程崩溃、Redis 抖动）时的兜底，保证任务最终被消费。
 *
 * 调度本身仅扫描 + 入队（不在调度线程做重活），符合"长任务走队列"约定。
 */
@Injectable()
export class TaskDispatchSchedule {
  constructor(
    private readonly taskService: TaskService,
    private readonly queueProducer: QueueProducer,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(TaskDispatchSchedule.name);
  }

  // 每 15 秒执行一次。TODO: 间隔可后续配置化（如 TASK_DISPATCH_CRON）。
  @Cron('*/15 * * * * *')
  async dispatchPending(): Promise<void> {
    const tasks = await this.taskService.findPendingForDispatch();
    if (tasks.length === 0) {
      return;
    }

    let dispatched = 0;
    for (const task of tasks) {
      try {
        await this.queueProducer.enqueue<TaskJobData>(
          QUEUE_NAMES.TASK,
          JOB_NAMES.TASK.EXECUTE,
          {
            taskUid: task.uid,
            type: task.type,
            payload: task.payload ?? undefined,
          },
          {
            // jobId=task.uid 跨完成态去重，重复投递幂等。
            jobId: task.uid,
            attempts: task.maxAttempts,
            backoff: { type: 'exponential', delay: 1000 },
          },
        );
        // CAS 标记已投递，避免下一轮重复捞取。
        await this.taskService.markDispatched(task.uid);
        dispatched += 1;
      } catch (err) {
        this.logger.error(
          `兜底投递任务失败 taskUid=${task.uid}: ${(err as Error).message}`,
        );
      }
    }

    if (dispatched > 0) {
      this.logger.warn(`dispatcher 兜底投递 ${dispatched}/${tasks.length} 个任务`);
    }
  }
}
