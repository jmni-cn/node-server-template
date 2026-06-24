import { Module } from '@nestjs/common';
import { SecurityModule } from '@platform/security';
import { IdentityModule } from '@domains/identity';
import { PasswordController } from './password.controller';
import { SessionsController } from './sessions.controller';
import { ExternalAccountsController } from './external-accounts.controller';

/** 用户端安全中心模块：密码、会话、外部账号。 */
@Module({
  imports: [SecurityModule, IdentityModule],
  controllers: [
    PasswordController,
    SessionsController,
    ExternalAccountsController,
  ],
})
export class SecurityCenterModule {}
