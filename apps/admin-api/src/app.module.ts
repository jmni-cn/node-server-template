import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { AppConfigModule } from '@core/config';
import { DatabaseModule } from '@core/database';
import { LoggerModule } from '@core/logger';
import { RequestContextModule } from '@core/request-context';
import { I18nModule } from '@core/i18n';
import { CacheModule } from '@platform/cache';
import { QueueModule } from '@platform/queue';
import { AuthModule, AdminJwtAuthGuard, PermissionsGuard } from '@platform/auth';
import { SecurityModule } from '@platform/security';
import { AuditModule, OperationLogInterceptor } from '@platform/audit';
import { TaskModule } from '@platform/task';
import { HealthModule } from '@platform/health';
import { IdentityModule, IdentitySecurityPortsModule } from '@domains/identity';
import { AccessControlModule } from '@domains/access-control';
import { SystemModule } from '@domains/system';
import { SsoModule } from '@integrations/sso';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminAuthModule } from './modules/auth/admin-auth.module';
import { AdminSsoModule } from './modules/sso/admin-sso.module';
import { AdminUsersModule } from './modules/users/admin-users.module';
import { AdministratorsModule } from './modules/administrators/administrators.module';
import { AdminAccessControlModule } from './modules/access-control/admin-access-control.module';
import { AdminSystemModule } from './modules/system/admin-system.module';
import { AdminAuditModule } from './modules/audit/admin-audit.module';
import { AdminTasksModule } from './modules/tasks/admin-tasks.module';
import { AdminHealthModule } from './modules/health/admin-health.module';

/**
 * admin-api 根模块。
 *
 * 装配全部基础设施（core / platform）与领域模块（domains / integrations），
 * 并注册全局守卫：
 * - {@link AdminJwtAuthGuard}：默认要求 admin JWT，`@Public()` 可豁免；
 * - {@link PermissionsGuard}：基于 `@Permissions()` 元数据的 RBAC 校验
 *   （`ACCESS_CHECKER` 由 AccessControlModule 提供）。
 */
@Module({
  imports: [
    // ---- core ----
    AppConfigModule,
    DatabaseModule,
    LoggerModule,
    RequestContextModule,
    I18nModule,
    // ---- platform ----
    CacheModule,
    QueueModule.forRoot(),
    AuthModule.forRoot(),
    SecurityModule,
    AuditModule,
    TaskModule,
    HealthModule,
    // ---- domains / integrations ----
    IdentityModule,
    // 绑定平台层安全端口（ACCESS_SESSION_VALIDATOR / SECURITY_EVENT_RECORDER）到 identity 实现。
    IdentitySecurityPortsModule,
    AccessControlModule,
    SystemModule,
    SsoModule,
    // ---- feature modules ----
    AdminAuthModule,
    AdminSsoModule,
    AdminUsersModule,
    AdministratorsModule,
    AdminAccessControlModule,
    AdminSystemModule,
    AdminAuditModule,
    AdminTasksModule,
    AdminHealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 全局守卫顺序：先认证（AdminJwtAuthGuard），再鉴权（PermissionsGuard）。
    { provide: APP_GUARD, useClass: AdminJwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // 全局操作日志拦截器（读取 @OperationLogDecorator 元数据并入队）。
    { provide: APP_INTERCEPTOR, useClass: OperationLogInterceptor },
    // 说明：ACCESS_SESSION_VALIDATOR 与 SECURITY_EVENT_RECORDER 两个平台层端口
    // 现由 @Global 的 IdentityModule 统一绑定并导出（见 IdentityModule），
    // 以保证 @platform/auth 的 passport 策略 / PermissionsGuard 能在其自身上下文解析到实现。
  ],
})
export class AppModule {}
