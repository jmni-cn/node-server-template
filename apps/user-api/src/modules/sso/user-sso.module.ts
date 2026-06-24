import { Module } from '@nestjs/common';
import { AuthModule } from '@platform/auth';
import { SsoModule } from '@integrations/sso';
import { IdentityModule } from '@domains/identity';
import { UserAuthModule } from '../auth/user-auth.module';
import { UserSsoController } from './user-sso.controller';
import { UserSsoService } from './user-sso.service';

/** 用户端 SSO 模块。 */
@Module({
  imports: [AuthModule.forRoot(), SsoModule, IdentityModule, UserAuthModule],
  controllers: [UserSsoController],
  providers: [UserSsoService],
})
export class UserSsoModule {}
