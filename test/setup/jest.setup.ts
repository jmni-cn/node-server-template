/**
 * Global Jest setup — runs once per worker before the test framework loads.
 *
 * - Imports reflect-metadata so decorator metadata is available in every test
 *   (NestJS DI, class-validator, TypeORM all rely on it).
 * - Establishes safe env defaults so unit tests that read config don't crash
 *   when run outside docker/CI. Anything already set (e.g. by CI service
 *   containers or docker-compose.test.yml) is preserved.
 */
import 'reflect-metadata';

const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  APP_NAME: 'admin-api',

  DB_HOST: '127.0.0.1',
  DB_PORT: '3306',
  DB_USERNAME: 'root',
  DB_PASSWORD: 'root',
  DB_DATABASE: 'app_template_test',
  DB_LOGGING: 'false',

  REDIS_HOST: '127.0.0.1',
  REDIS_PORT: '6379',
  REDIS_DB: '1',

  // 必须与 @core/config 校验 schema 对齐：JWT_ACCESS_SECRET / JWT_REFRESH_SECRET
  // 均要求至少 32 字符。
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef',
  JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',

  // LOG_LEVEL 合法值：trace|debug|info|warn|error|fatal（无 'silent'），测试用最安静的 fatal。
  LOG_LEVEL: 'fatal',
  DEFAULT_LANGUAGE: 'zh-CN',
};

for (const [key, value] of Object.entries(defaults)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}
