import { Global, Module } from '@nestjs/common';
import { RequestContextService } from './request-context.service';

/**
 * 请求上下文模块（全局）。
 * 提供 RequestContextService 供整个应用注入使用。
 * 上下文初始化由 RequestContextMiddleware 或 RequestContextInterceptor 负责。
 */
@Global()
@Module({
  providers: [RequestContextService],
  exports: [RequestContextService],
})
export class RequestContextModule {}
