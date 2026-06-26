import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { RequestContextService } from '@core/request-context';
import { QUEUE_NAMES, QueueName } from './queue.constants';
import { JOB_NAMES } from './job-names';
import type { DeadLetterJobData, EnqueueOptions } from './queue.types';

/**
 * QueueProducer — 通用入队服务。
 *
 * 通过 ModuleRef 按需解析已注册的 BullMQ 队列实例，避免在构造函数里硬编码
 * 依赖具体队列（不同 app 注册的队列子集不同）。
 *
 * @example
 * ```typescript
 * await producer.enqueue(QUEUE_NAMES.AUDIT, JOB_NAMES.AUDIT.WRITE_OPERATION_LOG, data);
 * ```
 */
@Injectable()
export class QueueProducer {
  private readonly cache = new Map<string, Queue>();

  constructor(private readonly moduleRef: ModuleRef) {}

  /**
   * 入队一个 job。
   *
   * @param queueName 队列名（QUEUE_NAMES.*）
   * @param jobName   job 名（JOB_NAMES.*.*）
   * @param data      job 负载
   * @param opts      BullMQ 入队选项
   */
  async enqueue<T = unknown>(
    queueName: QueueName,
    jobName: string,
    data: T,
    opts?: EnqueueOptions,
  ): Promise<void> {
    const queue = this.resolveQueue(queueName);
    await queue.add(jobName, this.withContext(data), opts);
  }

  /**
   * 批量入队同一队列的多个 job。
   */
  async enqueueBulk<T = unknown>(
    queueName: QueueName,
    jobs: Array<{ name: string; data: T; opts?: EnqueueOptions }>,
  ): Promise<void> {
    const queue = this.resolveQueue(queueName);
    await queue.addBulk(
      jobs.map((job) => ({ ...job, data: this.withContext(job.data) })),
    );
  }

  /**
   * 将一条重试耗尽的失败 job 转投死信队列（DLQ）。
   *
   * processor 在 `@OnWorkerEvent('failed')` 钩子中、当
   * `job.attemptsMade >= (job.opts.attempts ?? 1)` 时调用，避免失败 job 被静默丢弃，
   * 保留原队列 / job 名 / 负载 / 失败原因供人工排查或重放。
   *
   * DLQ 记录本身不再重试（attempts=1），并设较长保留期。
   */
  async enqueueDeadLetter(entry: DeadLetterJobData): Promise<void> {
    await this.enqueue<DeadLetterJobData>(
      QUEUE_NAMES.DEAD_LETTER,
      JOB_NAMES.DEAD_LETTER.RECORD,
      entry,
      { attempts: 1, removeOnComplete: false, removeOnFail: false },
    );
  }

  /**
   * 从当前请求上下文注入 requestId/traceId 到 job 负载，
   * 使 worker 消费时可重建链路上下文（已存在的字段不覆盖）。
   *
   * 仅当负载为普通对象时注入；非对象负载原样返回。
   */
  private withContext<T>(data: T): T {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return data;
    }
    const ctx = RequestContextService.getContext();
    if (!ctx) return data;

    const payload = data as Record<string, unknown>;
    return {
      ...payload,
      requestId: payload.requestId ?? ctx.requestId ?? null,
      traceId: payload.traceId ?? ctx.traceId ?? null,
    } as T;
  }

  /** 解析（并缓存）指定队列实例。 */
  private resolveQueue(queueName: QueueName): Queue {
    const cached = this.cache.get(queueName);
    if (cached) return cached;
    const queue = this.moduleRef.get<Queue>(getQueueToken(queueName), {
      strict: false,
    });
    this.cache.set(queueName, queue);
    return queue;
  }
}
