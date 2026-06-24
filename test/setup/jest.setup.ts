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

  JWT_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',

  LOG_LEVEL: 'silent',
  DEFAULT_LANGUAGE: 'zh-CN',
};

for (const [key, value] of Object.entries(defaults)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}
