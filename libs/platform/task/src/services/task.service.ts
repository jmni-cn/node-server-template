import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '@core/common';
import { LoggerService } from '@core/logger';
import { QueueProducer, QUEUE_NAMES, JOB_NAMES } from '@platform/queue';
import type { EnqueueOptions } from '@platform/queue';
import { Task, TaskLog } from '../entities';
import { TaskStatus, TaskErrorCode } from '../constants';
import type { CreateTaskInput } from '../types';

/**
 * 任务核心服务：负责创建、入队、状态流转与日志写入。
 */
@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(TaskLog)
    private readonly logRepo: Repository<TaskLog>,
    private readonly queueProducer: QueueProducer,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(TaskService.name);
  }

  /**
   * 创建任务（状态 PENDING），不入队。
   */
  async create(input: CreateTaskInput): Promise<Task> {
    const task = this.taskRepo.create({
      name: input.name,
      type: input.type,
      payload: input.payload ?? null,
      status: TaskStatus.PENDING,
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 3,
      scheduledAt: input.scheduledAt ?? null,
    });
    return this.taskRepo.save(task);
  }

  /**
   * 创建任务并入队执行。若 scheduledAt 在未来则按 delay 延迟入队。
   */
  async createAndEnqueue(input: CreateTaskInput): Promise<Task> {
    const task = await this.create(input);

    const opts: EnqueueOptions = {};
    if (input.scheduledAt) {
      const delay = input.scheduledAt.getTime() - Date.now();
      if (delay > 0) {
        opts.delay = delay;
      }
    }

    try {
      await this.queueProducer.enqueue(
        QUEUE_NAMES.TASK,
        JOB_NAMES.TASK.EXECUTE,
        {
          taskUid: task.uid,
          type: task.type,
          payload: input.payload,
        },
        opts,
      );
    } catch (err) {
      this.logger.error(
        `任务入队失败 taskUid=${task.uid}: ${(err as Error).message}`,
      );
      throw new BusinessException(TaskErrorCode.TASK_ENQUEUE_FAILED, {
        taskUid: task.uid,
      });
    }

    return task;
  }

  /**
   * 按 UID 查找任务，不存在则抛 TASK_NOT_FOUND。
   */
  async findByUid(uid: string): Promise<Task> {
    const task = await this.taskRepo.findOne({ where: { uid } });
    if (!task) {
      throw new BusinessException(TaskErrorCode.TASK_NOT_FOUND, { uid });
    }
    return task;
  }

  /**
   * 更新任务状态，并按状态维护开始/结束时间与错误信息。
   */
  async updateStatus(
    uid: string,
    status: TaskStatus,
    opts?: { error?: string },
  ): Promise<Task> {
    const task = await this.findByUid(uid);
    task.status = status;

    if (status === TaskStatus.RUNNING) {
      task.startedAt = new Date();
    } else if (status === TaskStatus.SUCCESS || status === TaskStatus.FAILED) {
      task.finishedAt = new Date();
    }

    if (opts?.error !== undefined) {
      task.error = opts.error;
    }

    return this.taskRepo.save(task);
  }

  /**
   * 标记任务为运行中，并递增尝试次数。
   */
  async markRunning(uid: string): Promise<Task> {
    const task = await this.findByUid(uid);
    task.status = TaskStatus.RUNNING;
    task.startedAt = new Date();
    task.attempts += 1;
    return this.taskRepo.save(task);
  }

  /**
   * 标记任务为成功。
   */
  async markSuccess(uid: string): Promise<Task> {
    return this.updateStatus(uid, TaskStatus.SUCCESS);
  }

  /**
   * 标记任务为失败，并记录错误信息。
   */
  async markFailed(uid: string, error: string): Promise<Task> {
    return this.updateStatus(uid, TaskStatus.FAILED, { error });
  }

  /**
   * 写入一条任务日志。
   */
  async addLog(taskUid: string, level: string, message: string): Promise<void> {
    const log = this.logRepo.create({ taskUid, level, message });
    await this.logRepo.save(log);
  }
}
