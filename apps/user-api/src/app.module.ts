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
import { IdentityModule } from '@domains/identity';
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
  ],
})
export class AppModule {}
