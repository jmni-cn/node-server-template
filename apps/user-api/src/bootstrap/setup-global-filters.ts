import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { I18nService } from 'nestjs-i18n';
import { AllExceptionsFilter } from '@core/common';
import { LoggerService } from '@core/logger';

/** 注册全局异常过滤器。 */
export async function setupGlobalFilters(
  app: NestFastifyApplication,
): Promise<void> {
  const i18n = app.get<I18nService<Record<string, unknown>>>(I18nService);
  const logger = await app.resolve(LoggerService);
  logger.setContext('ExceptionFilter');
  app.useGlobalFilters(new AllExceptionsFilter(i18n, logger));
}
