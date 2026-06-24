import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { LoggingInterceptor, TransformInterceptor } from '@core/common';
import { LoggerService } from '@core/logger';

/**
 * 注册全局拦截器：
 * - LoggingInterceptor：请求/响应日志；
 * - TransformInterceptor：统一响应信封。
 *
 * 注意：OperationLogInterceptor 依赖 DI（QueueProducer 等），在 AppModule 中以
 * APP_INTERCEPTOR 形式注册，不在此手动实例化。
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
