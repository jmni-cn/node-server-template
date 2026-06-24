import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { registerErrorCodeHttpStatus } from '@core/common';
import { LoggerModule } from '@core/logger';
import { QueueModule, QUEUE_NAMES } from '@platform/queue';
import { Task, TaskLog } from './entities';
import { TaskService, TaskQueryService, TaskRetryService } from './services';
import { TaskAssembler } from './assembler';
import { TaskErrorCodeHttpStatus } from './constants';

// 注册本模块错误码 → HTTP 状态映射。
registerErrorCodeHttpStatus(TaskErrorCodeHttpStatus);

/**
 * @platform/task — 通用异步任务模块。
 *
 * 提供任务的创建、入队、状态流转、查询与重试能力，
 * 任务执行通过 @platform/queue 的 `task` 队列异步分发。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskLog]),
    LoggerModule,
    QueueModule.registerQueues([QUEUE_NAMES.TASK]),
  ],
  providers: [TaskService, TaskQueryService, TaskRetryService, TaskAssembler],
  exports: [TaskService, TaskQueryService, TaskRetryService, TaskAssembler],
})
export class TaskModule {}
