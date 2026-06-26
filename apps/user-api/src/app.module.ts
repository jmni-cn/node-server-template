import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { AppConfigModule } from '@core/config';
import { DatabaseModule } from '@core/database';
import { LoggerModule } from '@core/logger';
import { RequestContextModule } from '@core/request-context';
import { I18nModule } from '@core/i18n';
import { CacheModule } from '@platform/cache';
import { QueueModule } from '@platform/queue';
import { AuthModule, UserJwtAuthGuard } from '@platform/auth';
import { SecurityModule } from '@platform/security';
import { AuditModule, OperationLogInterceptor } from '@platform/audit';
import { HealthModule } from '@platform/health';
import { IdentityModule, IdentitySecurityPortsModule } from '@domains/identity';
import { SsoModule } from '@integrations/sso';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserAuthModule } from './modules/auth/user-auth.module';
import { UserSsoModule } from './modules/sso/user-sso.module';
import { ProfileModule } from './modules/profile/profile.module';
import { SecurityCenterModule } from './modules/security-center/security-center.module';
import { UserHealthModule } from './modules/health/user-health.module';

/**
 * user-api 根模块。
 *
 * 注册全局守卫 {@link UserJwtAuthGuard}（默认要求 user JWT，`@Public()` 豁免）。
 * 用户端无 RBAC，因此不注册 PermissionsGuard。
 */
@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    LoggerModule,
    RequestContextModule,
    I18nModule,
    CacheModule,
    QueueModule.forRoot(),
    AuthModule.forRoot(),
    SecurityModule,
    AuditModule,
    HealthModule,
    IdentityModule,
    // 绑定平台层安全端口（ACCESS_SESSION_VALIDATOR / SECURITY_EVENT_RECORDER）到 identity 实现。
    IdentitySecurityPortsModule,
    SsoModule,
    // feature modules
    UserAuthModule,
    UserSsoModule,
    ProfileModule,
    SecurityCenterModule,
    UserHealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: UserJwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: OperationLogInterceptor },
    // 说明：ACCESS_SESSION_VALIDATOR 端口现由 @Global 的 IdentityModule 统一绑定并导出，
    // 以保证 @platform/auth 的 passport 策略能在其自身上下文解析到实现（详见 IdentityModule）。
  ],
})
export class AppModule {}
