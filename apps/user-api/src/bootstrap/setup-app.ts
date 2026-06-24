import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';

/**
 * 设置全局路由前缀。
 *
 * user-api 默认无前缀（`USER_API_PREFIX` 默认 ''），可通过环境变量覆盖。
 */
export function setupApp(app: NestFastifyApplication): void {
  const config = app.get(ConfigService);
  const prefix = config.get<string>('USER_API_PREFIX') ?? '';
  if (prefix) {
    app.setGlobalPrefix(prefix);
  }
}
