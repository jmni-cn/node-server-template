import { DynamicModule, Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { queueConfig } from '@core/config';
import { ALL_QUEUE_NAMES, QueueName } from './queue.constants';
import { QueueProducer } from './queue.producer';

/**
 * @platform/queue — BullMQ 队列模块。
 *
 * - `forRoot()`：在根模块注册 BullMQ 全局连接（来自 queueConfig），仅一次；
 * - `registerQueues(names)`：注册指定队列（producer 侧 app 与 worker 侧共用）；
 * - 默认 `forRoot()` 会注册全部 QUEUE_NAMES 并导出 QueueProducer。
 */
@Global()
@Module({})
export class QueueModule {
  /**
   * 注册 BullMQ 全局连接 + 全部队列 + QueueProducer。
   * 应在每个进程（app / worker）的根模块导入一次。
   */
  static forRoot(queues: QueueName[] = ALL_QUEUE_NAMES): DynamicModule {
    const rootConnection = BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [queueConfig.KEY],
      useFactory: (cfg: ConfigType<typeof queueConfig>) => ({
        connection: {
          host: cfg.connection.host,
          port: cfg.connection.port,
          password: cfg.connection.password,
          db: cfg.connection.db,
          // BullMQ 阻塞命令（如 BRPOPLPUSH）要求 maxRetriesPerRequest=null，
          // 否则 ioredis 默认重试上限会在断连时抛错中断 worker。
          maxRetriesPerRequest: null,
          // 断连后指数退避重连（上限 2s），避免 Redis 抖动导致进程崩溃。
          retryStrategy: (times: number) => Math.min(times * 200, 2000),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      }),
    });

    const queueRegistrations = QueueModule.registerQueues(queues);

    return {
      module: QueueModule,
      imports: [rootConnection, queueRegistrations],
      providers: [QueueProducer],
      exports: [QueueProducer, queueRegistrations],
    };
  }

  /**
   * 注册一批队列（不含全局连接）。
   *
   * 用于只需消费/生产特定队列的子模块；返回的 DynamicModule 同时导出这些
   * 队列 provider，便于注入 `@InjectQueue(name)`。
   */
  static registerQueues(names: QueueName[]): DynamicModule {
    const registered = BullModule.registerQueue(
      ...names.map((name) => ({ name })),
    );
    return {
      module: QueueModule,
      imports: [registered],
      exports: [registered],
    };
  }
}
