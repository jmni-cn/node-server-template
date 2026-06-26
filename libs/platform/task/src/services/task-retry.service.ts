import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '@core/common';
import { LoggerService } from '@core/logger';
import { QueueProducer, QUEUE_NAMES, JOB_NAMES } from '@platform/queue';
import { Task } from '../entities';
import { TaskStatus, TaskErrorCode } from '../constants';

/**
 * 任务重试服务：将失败任务重新入队执行。
 */
@Injectable()
export class TaskRetryService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly queueProducer: QueueProducer,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(TaskRetryService.name);
  }

  /**
   * 重试一个失败的任务。
   *
   * - 仅允许 FAILED 状态的任务重试，否则抛 TASK_INVALID_STATE；
   * - 已达最大尝试次数则抛 TASK_MAX_ATTEMPTS；
   * - 置为 RETRYING 并重新入队（JOB_NAMES.TASK.RETRY）。
   */
  async retry(uid: string): Promise<Task> {
    const task = await this.taskRepo.findOne({ where: { uid } });
    if (!task) {
      throw new BusinessException(TaskErrorCode.TASK_NOT_FOUND, { uid });
    }

    if (task.status !== TaskStatus.FAILED) {
      throw new BusinessException(TaskErrorCode.TASK_INVALID_STATE, {
        uid,
        status: task.status,
      });
    }

    if (task.attempts >= task.maxAttempts) {
      throw new BusinessException(TaskErrorCode.TASK_MAX_ATTEMPTS, {
        uid,
        attempts: task.attempts,
        maxAttempts: task.maxAttempts,
      });
    }

    task.status = TaskStatus.RETRYING;
    await this.taskRepo.save(task);

    try {
      await this.queueProducer.enqueue(
        QUEUE_NAMES.TASK,
        JOB_NAMES.TASK.RETRY,
        {
          taskUid: task.uid,
          type: task.type,
          payload: task.payload ?? undefined,
        },
        {
          // 以 task.uid 为 jobId 跨完成态去重；剩余尝试次数 = maxAttempts - attempts。
          jobId: `${task.uid}:retry:${task.attempts}`,
          attempts: Math.max(1, task.maxAttempts - task.attempts),
          backoff: { type: 'exponential', delay: 1000 },
        },
      );
    } catch (err) {
      this.logger.error(
        `任务重试入队失败 taskUid=${task.uid}: ${(err as Error).message}`,
      );
      throw new BusinessException(TaskErrorCode.TASK_ENQUEUE_FAILED, {
        taskUid: task.uid,
      });
    }

    return task;
  }
}
