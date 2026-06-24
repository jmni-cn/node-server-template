import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';
import { REDIS_DEFAULTS } from './constants';

/**
 * Redis 配置命名空间
 */
export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST ?? REDIS_DEFAULTS.HOST,
  port: parseInt(process.env.REDIS_PORT ?? String(REDIS_DEFAULTS.PORT), 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB ?? String(REDIS_DEFAULTS.DB), 10),
}));

/**
 * Redis 配置接口
 */
export interface RedisConfigType {
  host: string;
  port: number;
  password: string | undefined;
  db: number;
}

/**
 * Redis 配置验证 Schema
 */
export const redisConfigSchema = {
  REDIS_HOST: Joi.string()
    .default(REDIS_DEFAULTS.HOST)
    .description('Redis 主机'),
  REDIS_PORT: Joi.number()
    .port()
    .default(REDIS_DEFAULTS.PORT)
    .description('Redis 端口'),
  REDIS_PASSWORD: Joi.string().allow('').default('').description('Redis 密码'),
  REDIS_DB: Joi.number()
    .min(0)
    .max(15)
    .default(REDIS_DEFAULTS.DB)
    .description('Redis 数据库索引'),
};
