import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, type HealthCheckResult } from '@nestjs/terminus';
import { Public } from '@platform/auth';
import { HealthService } from '@platform/health';

/** 用户端健康检查控制器（公开）。 */
@ApiTags('健康检查')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: '依赖健康检查（database/redis/queue）' })
  check(): Promise<HealthCheckResult> {
    return this.healthService.check();
  }

  @Public()
  @Get('liveness')
  @ApiOperation({ summary: '存活探针' })
  liveness(): { status: string; timestamp: string } {
    return this.healthService.liveness();
  }
}
