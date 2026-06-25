import { WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

/**
 * BaseQueueProcessor — worker 侧 processor 的抽象基类。
 *
 * 子类用 `@Processor(QUEUE_NAMES.XXX)` 装饰，并实现 `handle(job)`。
 * 基类提供按 `job.name` 分发到 `handlers` 映射的能力，避免每个 processor
 * 重复写 switch。
 *
 * @example
 * ```typescript
 * @Processor(QUEUE_NAMES.AUDIT)
 * export class AuditProcessor extends BaseQueueProcessor {
 *   protected handlers = {
 *     [JOB_NAMES.AUDIT.WRITE_OPERATION_LOG]: (job) => this.write(job.data),
 *   };
 * }
 * ```
 */
export abstract class BaseQueueProcessor extends WorkerHost {
  /** job 名 → 处理函数 映射，由子类提供（处理函数可同步或返回 Promise）。 */
  protected abstract handlers: Record<string, (job: Job) => unknown>;

  /**
   * BullMQ worker 入口：按 job.name 分发。
   * 未注册的 job 名直接抛错（以 rejected Promise 形式），交由 BullMQ 重试/失败处理。
   */
  process(job: Job): Promise<unknown> {
    const handler = this.handlers[job.name];
    if (!handler) {
      return Promise.reject(
        new Error(
          `No handler registered for job "${job.name}" in queue "${job.queueName}"`,
        ),
      );
    }
    return Promise.resolve(handler(job));
  }
}
