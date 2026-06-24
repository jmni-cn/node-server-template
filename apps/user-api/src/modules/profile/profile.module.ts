import { Module } from '@nestjs/common';
import { IdentityModule } from '@domains/identity';
import { ProfileController } from './profile.controller';

/** 用户端个人资料模块。 */
@Module({
  imports: [IdentityModule],
  controllers: [ProfileController],
})
export class ProfileModule {}
