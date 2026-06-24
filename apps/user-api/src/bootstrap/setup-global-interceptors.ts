import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { LoggingInterceptor, TransformInterceptor } from '@core/common';
import { LoggerService } from '@core/logger';

/**
 * 注册全局拦截器：LoggingInterceptor + TransformInterceptor。
 *
 * OperationLogInterceptor 依赖 DI，在 AppModule 中以 APP_INTERCEPTOR 注册。
 */
export async function setupGlobalInterceptors(
  app: NestFastifyApplication,
): Promise<void> {
  const logger = await app.resolve(LoggerService);
  logger.setContext('HTTP');
  app.useGlobalInterceptors(
    new LoggingInterceptor(logger),
    new TransformInterceptor(),
  );
}
