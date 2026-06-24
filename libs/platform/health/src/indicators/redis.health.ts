import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';
import { RedisService } from '@platform/cache';

/**
 * Redis 健康指示器：通过 `RedisService.ping()` 校验连通性，
 * 期望回复 'PONG'。使用 terminus 11 的 `HealthIndicatorService` 模式。
 */
@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly redisService: RedisService,
  ) {}

  /** 探测 Redis 连接是否健康。 */
  async isHealthy(key = 'redis'): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      const pong = await this.redisService.ping();
      return pong === 'PONG'
        ? indicator.up()
        : indicator.down({ message: 'unexpected ping reply' });
    } catch (e) {
      return indicator.down({ message: (e as Error).message });
    }
  }
}
