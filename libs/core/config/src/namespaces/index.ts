// 配置常量导出
export * from './constants';

// 配置命名空间导出
export { appConfig, appConfigSchema, type AppConfigType } from './app.config';
export {
  databaseConfig,
  databaseConfigSchema,
  type DatabaseConfigType,
} from './database.config';
export {
  redisConfig,
  redisConfigSchema,
  type RedisConfigType,
} from './redis.config';
export { jwtConfig, jwtConfigSchema, type JwtConfigType } from './jwt.config';
export {
  ssoConfig,
  ssoConfigSchema,
  type SsoConfigType,
  type SsoMicrosoftConfigType,
  type SsoKraftonConfigType,
} from './sso.config';
export {
  queueConfig,
  queueConfigSchema,
  type QueueConfigType,
} from './queue.config';
export {
  loggerConfig,
  loggerConfigSchema,
  type LoggerConfigType,
} from './logger.config';
export {
  i18nConfig,
  i18nConfigSchema,
  type I18nConfigType,
} from './i18n.config';

// 所有配置命名空间（用于 ConfigModule.forRoot 的 load 选项）
import { appConfig } from './app.config';
import { databaseConfig } from './database.config';
import { redisConfig } from './redis.config';
import { jwtConfig } from './jwt.config';
import { ssoConfig } from './sso.config';
import { queueConfig } from './queue.config';
import { loggerConfig } from './logger.config';
import { i18nConfig } from './i18n.config';

/**
 * 所有配置命名空间数组（用于 ConfigModule.forRoot 的 load 选项）。
 */
export const configNamespaces = [
  appConfig,
  databaseConfig,
  redisConfig,
  jwtConfig,
  ssoConfig,
  queueConfig,
  loggerConfig,
  i18nConfig,
];

// 所有配置验证 Schema 片段
import { appConfigSchema } from './app.config';
import { databaseConfigSchema } from './database.config';
import { redisConfigSchema } from './redis.config';
import { jwtConfigSchema } from './jwt.config';
import { ssoConfigSchema } from './sso.config';
import { queueConfigSchema } from './queue.config';
import { loggerConfigSchema } from './logger.config';
import { i18nConfigSchema } from './i18n.config';

/**
 * 合并所有配置验证 Schema 片段。
 */
export const allConfigSchemas = {
  ...appConfigSchema,
  ...databaseConfigSchema,
  ...redisConfigSchema,
  ...jwtConfigSchema,
  ...ssoConfigSchema,
  ...queueConfigSchema,
  ...loggerConfigSchema,
  ...i18nConfigSchema,
};
