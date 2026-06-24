import { Module } from '@nestjs/common';
import { AuthModule } from '@platform/auth';
import { SecurityModule } from '@platform/security';
import { IdentityModule } from '@domains/identity';
import { UserAuthController } from './user-auth.controller';
import { UserAuthService } from './user-auth.service';

/** 用户端认证模块。 */
@Module({
  imports: [AuthModule.forRoot(), SecurityModule, IdentityModule],
  controllers: [UserAuthController],
  providers: [UserAuthService],
  exports: [UserAuthService],
})
export class UserAuthModule {}
