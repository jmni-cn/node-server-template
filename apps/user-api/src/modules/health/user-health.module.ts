import { Module } from '@nestjs/common';
import { HealthModule } from '@platform/health';
import { HealthController } from './health.controller';

/** 用户端健康检查模块。 */
@Module({
  imports: [HealthModule],
  controllers: [HealthController],
})
export class UserHealthModule {}
