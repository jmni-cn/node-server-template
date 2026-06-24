import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';

/**
 * 设置全局路由前缀。
 *
 * admin-api 默认前缀为 `admin`，可通过 `ADMIN_API_PREFIX` 覆盖。
 */
export function setupApp(app: NestFastifyApplication): void {
  const config = app.get(ConfigService);
  const prefix = config.get<string>('ADMIN_API_PREFIX') ?? 'admin';
  app.setGlobalPrefix(prefix);
}
