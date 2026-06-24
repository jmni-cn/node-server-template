import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { LoggerModule } from '@core/logger';
import { QueueModule, QUEUE_NAMES } from '@platform/queue';
import { HealthService } from './health.service';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { QueueHealthIndicator } from './indicators/queue.health';

/**
 * @platform/health — 聚合健康检查模块。
 *
 * 暴露 `HealthService` 与三个自定义指示器。TypeORM DataSource 与
 * RedisService 由 app 全局模块提供；本模块仅注册 SYSTEM 队列以供探测。
 */
@Module({
  imports: [
    TerminusModule,
    LoggerModule,
    QueueModule.registerQueues([QUEUE_NAMES.SYSTEM]),
  ],
  providers: [
    HealthService,
    DatabaseHealthIndicator,
    RedisHealthIndicator,
    QueueHealthIndicator,
  ],
  exports: [
    HealthService,
    DatabaseHealthIndicator,
    RedisHealthIndicator,
    QueueHealthIndicator,
  ],
})
export class HealthModule {}
