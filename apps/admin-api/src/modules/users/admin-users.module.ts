import { Module } from '@nestjs/common';
import { IdentityModule } from '@domains/identity';
import { AdminUsersController } from './admin-users.controller';

/** 管理后台用户管理模块。 */
@Module({
  imports: [IdentityModule],
  controllers: [AdminUsersController],
})
export class AdminUsersModule {}
