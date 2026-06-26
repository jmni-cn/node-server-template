import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { RequestContextMiddleware } from './request-context.middleware';

/**
 * 请求上下文模块（全局）。
 *
 * 提供 RequestContextService 供整个应用注入使用，并**自动**为所有路由挂载
 * {@link RequestContextMiddleware}，在请求进入时初始化 AsyncLocalStorage 上下文
 * （requestId / traceId / ip / 设备 / 地理位置）。下游的拦截器（UserContext /
 * Logging / OperationLog）、服务层日志与异常过滤器据此获取请求级上下文。
 *
 * 由于本模块 `@Global` 且实现 `NestModule.configure()`，各 app 只需在根模块
 * `imports` 中引入 `RequestContextModule` 即可——无需在 app 层再手动 apply 中间件。
 */
@Global()
@Module({
  providers: [RequestContextService],
  exports: [RequestContextService],
})
export class RequestContextModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
