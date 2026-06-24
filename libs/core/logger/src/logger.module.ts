import { Global, Module } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { LoggerInterceptor } from './logger.interceptor';

/**
 * 日志模块（全局）。
 * 提供 pino 实现的 LoggerService 与请求日志拦截器。
 */
@Global()
@Module({
  providers: [LoggerService, LoggerInterceptor],
  exports: [LoggerService, LoggerInterceptor],
})
export class LoggerModule {}
