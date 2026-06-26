import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { registerErrorCodeHttpStatus } from '@core/common';
import { LoggerModule } from '@core/logger';
import {
  ConfigRuntimeModule,
  registerConfigDefinitions,
  SystemConfigType,
} from '@platform/config';
import { QueueModule, QUEUE_NAMES } from '@platform/queue';
import { Task, TaskLog } from './entities';
import { TaskService, TaskQueryService, TaskRetryService } from './services';
import { TaskAssembler } from './assembler';
import { TaskErrorCodeHttpStatus, TASK_CONFIG_KEYS } from './constants';

// 注册本模块错误码 → HTTP 状态映射。
registerErrorCodeHttpStatus(TaskErrorCodeHttpStatus);

// 模块加载即注册任务可靠性运行时配置定义（仅「每次运行时读的阈值/limit/分钟数」，
// 不含 @Cron 周期）。DB 覆盖 → 代码默认 两层；默认值与 TASK_RELIABILITY_DEFAULTS 保持一致。
registerConfigDefinitions([
  {
    key: TASK_CONFIG_KEYS.DISPATCH_LEASE_GRACE_SECONDS,
    group: 'task',
    label: '投递租约宽限秒数',
    description:
      'dispatcher 仅重投 dispatched_at 早于 now-该值的任务，避免对刚直接投递成功的任务重复投递',
    valueType: SystemConfigType.NUMBER,
    defaultValue: 60,
  },
  {
    key: TASK_CONFIG_KEYS.DISPATCH_SCAN_LIMIT,
    group: 'task',
    label: 'dispatcher 单次扫描上限',
    description: '单次 dispatcher 扫描捞取的最大任务数',
    valueType: SystemConfigType.NUMBER,
    defaultValue: 100,
  },
  {
    key: TASK_CONFIG_KEYS.STALE_MINUTES,
    group: 'task',
    label: 'stale 判定分钟数',
    description:
      'RUNNING 且 locked_at 早于 now-该值视为卡死，应大于单个任务正常最长执行时长',
    valueType: SystemConfigType.NUMBER,
    defaultValue: 15,
  },
  {
    key: TASK_CONFIG_KEYS.STALE_SCAN_LIMIT,
    group: 'task',
    label: 'stale 恢复单次扫描上限',
    description: '单次 stale 恢复扫描处理的最大任务数',
    valueType: SystemConfigType.NUMBER,
    defaultValue: 100,
  },
]);

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
    ConfigRuntimeModule,
    QueueModule.registerQueues([QUEUE_NAMES.TASK]),
  ],
  providers: [TaskService, TaskQueryService, TaskRetryService, TaskAssembler],
  exports: [TaskService, TaskQueryService, TaskRetryService, TaskAssembler],
})
export class TaskModule {}
