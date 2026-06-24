import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';
import { QUEUE_DEFAULTS, REDIS_DEFAULTS } from './constants';

/**
 * 队列配置命名空间 (BullMQ + ioredis)。
 *
 * 复用 REDIS_* 默认值作为连接信息（可通过专用 QUEUE_REDIS_* 覆盖），
 * 并提供 worker 并发度配置。
 */
export const queueConfig = registerAs('queue', () => ({
  connection: {
    host:
      process.env.QUEUE_REDIS_HOST ??
      process.env.REDIS_HOST ??
      REDIS_DEFAULTS.HOST,
    port: parseInt(
      process.env.QUEUE_REDIS_PORT ??
        process.env.REDIS_PORT ??
        String(REDIS_DEFAULTS.PORT),
      10,
    ),
    password:
      process.env.QUEUE_REDIS_PASSWORD ??
      process.env.REDIS_PASSWORD ??
      undefined,
    db: parseInt(process.env.QUEUE_REDIS_DB ?? String(REDIS_DEFAULTS.DB), 10),
  },
  /** worker 并发度 */
  concurrency: parseInt(
    process.env.QUEUE_CONCURRENCY ?? String(QUEUE_DEFAULTS.CONCURRENCY),
    10,
  ),
}));

/**
 * 队列配置接口。
 */
export interface QueueConfigType {
  connection: {
    host: string;
    port: number;
    password: string | undefined;
    db: number;
  };
  concurrency: number;
}

/**
 * 队列配置验证 Schema。
 */
export const queueConfigSchema = {
  QUEUE_REDIS_HOST: Joi.string()
    .allow('')
    .optional()
    .description('队列专用 Redis 主机（缺省回退 REDIS_HOST）'),
  QUEUE_REDIS_PORT: Joi.number()
    .port()
    .optional()
    .description('队列专用 Redis 端口（缺省回退 REDIS_PORT）'),
  QUEUE_REDIS_PASSWORD: Joi.string()
    .allow('')
    .optional()
    .description('队列专用 Redis 密码（缺省回退 REDIS_PASSWORD）'),
  QUEUE_REDIS_DB: Joi.number()
    .min(0)
    .max(15)
    .optional()
    .description('队列专用 Redis 数据库索引'),
  QUEUE_CONCURRENCY: Joi.number()
    .integer()
    .min(1)
    .default(QUEUE_DEFAULTS.CONCURRENCY)
    .description('BullMQ worker 并发度'),
};
