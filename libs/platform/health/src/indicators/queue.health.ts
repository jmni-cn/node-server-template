import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';
import type { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@platform/queue';

/**
 * 队列健康指示器：取 BullMQ SYSTEM 队列底层连接并 ping，
 * 期望回复 'PONG'。使用 terminus 11 的 `HealthIndicatorService` 模式。
 */
@Injectable()
export class QueueHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @InjectQueue(QUEUE_NAMES.SYSTEM) private readonly queue: Queue,
  ) {}

  /** 探测队列底层 Redis 连接是否健康。 */
  async isHealthy(key = 'queue'): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      // bullmq 的 IRedisClient 接口未声明 ping，底层 ioredis 实例支持
      const client = (await this.queue.client) as unknown as {
        ping(): Promise<string>;
      };
      const pong = await client.ping();
      return pong === 'PONG'
        ? indicator.up()
        : indicator.down({ message: 'unexpected ping reply' });
    } catch (e) {
      return indicator.down({ message: (e as Error).message });
    }
  }
}
