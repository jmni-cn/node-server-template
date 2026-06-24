import { Injectable } from '@nestjs/common';
import { TypeOrmHealthIndicator } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';

/**
 * 数据库健康指示器：基于 terminus `TypeOrmHealthIndicator`，
 * 对应用全局注入的 TypeORM DataSource 执行 ping 探测。
 */
@Injectable()
export class DatabaseHealthIndicator {
  constructor(private readonly typeOrm: TypeOrmHealthIndicator) {}

  /** 对默认 DataSource 执行连通性探测（3s 超时）。 */
  isHealthy(key = 'database'): Promise<HealthIndicatorResult> {
    return this.typeOrm.pingCheck(key, { timeout: 3000 });
  }
}
