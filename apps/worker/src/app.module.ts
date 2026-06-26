import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AppConfigModule } from '@core/config';
import { DatabaseModule } from '@core/database';
import { LoggerModule } from '@core/logger';
import { CacheModule } from '@platform/cache';
import { QueueModule } from '@platform/queue';
import { AuditModule } from '@platform/audit';
import { TaskModule } from '@platform/task';
import { IdentityModule } from '@domains/identity';
import { SystemModule } from '@domains/system';

import { AuditLogProcessor } from './processors/audit/audit-log.processor';
import { UserRegisteredProcessor } from './processors/user/user-registered.processor';
import { UserLoginProcessor } from './processors/user/user-login.processor';
import { SsoProfileSyncProcessor } from './processors/sso/sso-profile-sync.processor';
import { TaskCleanupProcessor } from './processors/task/task-cleanup.processor';
import { TaskRetryProcessor } from './processors/task/task-retry.processor';
import { SystemMaintenanceProcessor } from './processors/system/system-maintenance.processor';

import { CleanupSchedule } from './schedules/cleanup.schedule';
import { SystemMaintenanceSchedule } from './schedules/system-maintenance.schedule';
import { TaskDispatchSchedule } from './schedules/task-dispatch.schedule';
import { TaskStaleRecoverySchedule } from './schedules/task-stale-recovery.schedule';

/**
 * worker 根模块。
 *
 * 装配基础设施 + 领域服务，并注册全部 BullMQ processors 与 cron schedules。
 * 调度由 `WORKER_ENABLE_SCHEDULE`（默认开启）控制：关闭时 schedules 不注册。
 */
const scheduleEnabled =
  (process.env.WORKER_ENABLE_SCHEDULE ?? 'true') !== 'false';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    LoggerModule,
    CacheModule,
    QueueModule.forRoot(),
    AuditModule,
    TaskModule,
    IdentityModule,
    SystemModule,
    ...(scheduleEnabled ? [ScheduleModule.forRoot()] : []),
  ],
  providers: [
    // ---- processors ----
    AuditLogProcessor,
    UserRegisteredProcessor,
    // UserLoginProcessor 由 UserRegisteredProcessor 委托调用（同队列单 WorkerHost）。
    UserLoginProcessor,
    SsoProfileSyncProcessor,
    TaskCleanupProcessor,
    TaskRetryProcessor,
    SystemMaintenanceProcessor,
    // ---- schedules（仅在启用时注册）----
    ...(scheduleEnabled
      ? [
          CleanupSchedule,
          SystemMaintenanceSchedule,
          // 任务可靠性兜底：PENDING 扫描投递 + 卡死任务恢复。
          TaskDispatchSchedule,
          TaskStaleRecoverySchedule,
        ]
      : []),
  ],
})
export class AppModule {}
