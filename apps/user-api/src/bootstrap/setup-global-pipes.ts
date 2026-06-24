import { ValidationPipe } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

/**
 * 注册全局验证管道（whitelist + transform）。
 */
export function setupGlobalPipes(app: NestFastifyApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      stopAtFirstError: true,
      whitelist: true,
      transform: true,
    }),
  );
}
