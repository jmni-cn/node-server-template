import { Module } from '@nestjs/common';
import { AuthModule } from '@platform/auth';
import { SecurityModule } from '@platform/security';
import { IdentityModule } from '@domains/identity';
import { AccessControlModule } from '@domains/access-control';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';

/**
 * 管理后台认证模块：装配认证控制器及其依赖的平台/领域模块。
 */
@Module({
  imports: [
    AuthModule.forRoot(),
    SecurityModule,
    IdentityModule,
    AccessControlModule,
  ],
  controllers: [AdminAuthController],
  providers: [AdminAuthService],
  exports: [AdminAuthService],
})
export class AdminAuthModule {}
