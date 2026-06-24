import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';
import { APP_DEFAULTS, APP_CONSTANTS } from './constants';

/**
 * 应用配置命名空间
 */
export const appConfig = registerAs('app', () => ({
  name: process.env.APP_NAME ?? APP_DEFAULTS.NAME,
  port: parseInt(process.env.APP_PORT ?? String(APP_DEFAULTS.PORT), 10),
  nodeEnv: process.env.NODE_ENV ?? APP_DEFAULTS.NODE_ENV,
  baseUrl:
    process.env.APP_BASE_URL ??
    `http://localhost:${process.env.APP_PORT ?? APP_DEFAULTS.PORT}`,
  apiPrefix: process.env.API_PREFIX ?? APP_DEFAULTS.API_PREFIX,
  cors: {
    enabled: APP_CONSTANTS.CORS_ENABLED,
    // 支持通过 CORS_ORIGIN 环境变量覆盖，多个域名用逗号分隔
    // 例：CORS_ORIGIN=https://app.example.com,https://admin.example.com
    origins: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
          .map((o) => o.trim())
          .filter(Boolean)
      : [...APP_CONSTANTS.CORS_ORIGINS],
  },
}));

/**
 * 应用配置接口
 */
export interface AppConfigType {
  name: string;
  port: number;
  nodeEnv: string;
  baseUrl: string;
  apiPrefix: string;
  cors: {
    enabled: boolean;
    /** 允许的来源列表，对应 @fastify/cors 的 origin 数组参数 */
    origins: string[];
  };
}

/**
 * 应用配置验证 Schema
 */
export const appConfigSchema = {
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default(APP_DEFAULTS.NODE_ENV)
    .description('运行环境'),
  APP_PORT: Joi.number()
    .port()
    .default(APP_DEFAULTS.PORT)
    .description('应用端口'),
  APP_NAME: Joi.string().default(APP_DEFAULTS.NAME).description('应用名称'),
  API_PREFIX: Joi.string()
    .pattern(/^[a-z][a-z0-9/-]*$/)
    .default(APP_DEFAULTS.API_PREFIX)
    .description('API 路由前缀 (api/admin, api/user)'),
  CORS_ENABLED: Joi.boolean()
    .default(APP_CONSTANTS.CORS_ENABLED)
    .description('是否开启 CORS'),
  CORS_ORIGIN: Joi.string()
    .default(APP_CONSTANTS.CORS_ORIGINS.join(','))
    .description(
      'CORS 允许的来源，多个域名用逗号分隔（禁止使用 *，会与 credentials: true 冲突）',
    ),
};
