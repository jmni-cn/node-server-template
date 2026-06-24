import { Injectable } from '@nestjs/common';
import { HealthCheckService } from '@nestjs/terminus';
import type { HealthCheckResult } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { QueueHealthIndicator } from './indicators/queue.health';

/**
 * 聚合健康检查服务。
 *
 * - `check()`：聚合 database / redis / queue 三项依赖的健康状态；
 * - `liveness()`：无依赖的存活探针，仅表示进程在运行。
 *
 * apps 自行创建 controller（如 `GET /health`）并调用本服务。
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: DatabaseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly queue: QueueHealthIndicator,
  ) {}

  /** 聚合 readiness 检查：database + redis + queue。 */
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
      () => this.queue.isHealthy('queue'),
    ]);
  }

  /** 存活探针：不触达任何外部依赖。 */
  liveness(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
