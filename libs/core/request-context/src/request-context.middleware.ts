import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { RequestContextService } from './request-context.service';
import type { RequestContextData } from './request-context.types';
import { buildRequestContextFromHeaders } from './request-context.util';
import { resolveGeoLocation } from './geo-location.util';

/**
 * 请求上下文中间件。
 * 在请求进入时初始化 AsyncLocalStorage 上下文：一次性解析 requestId/traceId/ip/设备信息，
 * 供整个请求生命周期（控制器、服务、拦截器、过滤器）使用。
 *
 * 注册示例（在某个模块中）：
 * ```typescript
 * export class AppModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     consumer.apply(RequestContextMiddleware).forRoutes('*');
 *   }
 * }
 * ```
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void) {
    const { requestId, traceId, ip, userAgent, deviceInfo } =
      buildRequestContextFromHeaders(req);

    // 解析地理位置（基于 geoip-lite，可选依赖；未安装时返回全 null，不影响主链路）
    const geoLocation = resolveGeoLocation(ip);

    const contextData: RequestContextData = {
      requestId,
      traceId,
      ip,
      userAgent,
      startTime: Date.now(),
      deviceInfo,
      geoLocation,
    };

    // 附加到请求对象，方便下游兼容性读取
    (req as unknown as { requestId?: string }).requestId = requestId;
    (req as unknown as { traceId?: string }).traceId = traceId;

    // 设置响应头
    res.setHeader('X-Request-ID', requestId);
    if (traceId) {
      res.setHeader('X-Trace-ID', traceId);
    }

    RequestContextService.run(contextData, () => {
      next();
    });
  }
}
