import { Module } from '@nestjs/common';
import { AuthModule } from '@platform/auth';
import { AuditModule } from '@platform/audit';
import { SsoModule } from '@integrations/sso';
import { IdentityModule } from '@domains/identity';
import { AccessControlModule } from '@domains/access-control';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminSsoController } from './admin-sso.controller';
import { AdminSsoService } from './admin-sso.service';

/** 管理后台 SSO 模块。 */
@Module({
  imports: [
    AuthModule.forRoot(),
    AuditModule,
    SsoModule,
    IdentityModule,
    AccessControlModule,
    AdminAuthModule,
  ],
  controllers: [AdminSsoController],
  providers: [AdminSsoService],
})
export class AdminSsoModule {}
