/**
 * @platform/queue — BullMQ 队列基础设施。
 *
 * 提供 QueueModule（全局连接 + 队列注册）、QueueProducer（通用入队）、
 * BaseQueueProcessor（worker 分发基类）、队列/Job 名常量与 job 负载类型。
 */
export * from './queue.constants';
export * from './job-names';
export * from './queue.types';
export * from './queue.producer';
export * from './queue.processor';
export * from './queue.module';
