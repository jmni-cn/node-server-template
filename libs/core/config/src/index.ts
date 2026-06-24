/**
 * @core/config — 配置管理
 *
 * 封装 @nestjs/config，按 APP_NAME 加载 env 文件，Joi 校验，
 * 暴露 app/database/redis/jwt/sso/queue/logger/i18n 配置命名空间。
 */

export * from './config.module';

// 配置验证
export {
  configValidationSchema,
  configValidationOptions,
} from './config.validation';

// 命名空间配置（数组 + 各 registerAs + schema + 类型）
export {
  configNamespaces,
  appConfig,
  appConfigSchema,
  type AppConfigType,
  databaseConfig,
  databaseConfigSchema,
  type DatabaseConfigType,
  redisConfig,
  redisConfigSchema,
  type RedisConfigType,
  jwtConfig,
  jwtConfigSchema,
  type JwtConfigType,
  ssoConfig,
  ssoConfigSchema,
  type SsoConfigType,
  type SsoMicrosoftConfigType,
  type SsoKraftonConfigType,
  queueConfig,
  queueConfigSchema,
  type QueueConfigType,
  loggerConfig,
  loggerConfigSchema,
  type LoggerConfigType,
  i18nConfig,
  i18nConfigSchema,
  type I18nConfigType,
} from './namespaces';
