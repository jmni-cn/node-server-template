import { Module } from '@nestjs/common';
import { IdentityModule } from '@domains/identity';
import { AccessControlModule } from '@domains/access-control';
import { AdministratorsController } from './administrators.controller';
import { AdministratorsService } from './administrators.service';

/** 管理后台「管理员账号」管理模块。 */
@Module({
  imports: [IdentityModule, AccessControlModule],
  controllers: [AdministratorsController],
  providers: [AdministratorsService],
})
export class AdministratorsModule {}
