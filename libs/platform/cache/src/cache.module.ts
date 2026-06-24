import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import IORedis from 'ioredis';
import { redisConfig } from '@core/config';
import { REDIS_CLIENT } from './cache.constants';
import { RedisService } from './redis.service';
import { CacheService } from './cache.service';

/**
 * @platform/cache — 全局缓存模块。
 *
 * 从 `redisConfig`（@core/config）创建单例 ioredis 客户端，
 * 暴露 `RedisService`（薄封装）与 `CacheService`（JSON + TTL + namespace）。
 *
 * 标记为 @Global，应用内只需在根模块导入一次。
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [redisConfig.KEY],
      useFactory: (cfg: ConfigType<typeof redisConfig>) => {
        return new IORedis({
          host: cfg.host,
          port: cfg.port,
          password: cfg.password,
          db: cfg.db,
          maxRetriesPerRequest: null,
          lazyConnect: false,
        });
      },
    },
    RedisService,
    CacheService,
  ],
  exports: [REDIS_CLIENT, RedisService, CacheService],
})
export class CacheModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: IORedis) {}

  /** 应用关闭时优雅断开 ioredis 连接。 */
  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
