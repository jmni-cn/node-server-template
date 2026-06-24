import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FastifyRequest, FastifyReply } from 'fastify';
import { RequestContextService } from './request-context.service';
import type { RequestContextData } from './request-context.types';
import { buildRequestContextFromHeaders } from './request-context.util';

/**
 * 请求上下文拦截器（中间件的等价替代方案）。
 *
 * 当不便注册中间件时（如纯拦截器栈），可用本拦截器在 AsyncLocalStorage
 * 上下文中执行后续处理。注意：中间件方案更靠前，能覆盖更早阶段的异常；
 * 二者择一即可，避免重复初始化上下文。
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    const { requestId, traceId, ip, userAgent, deviceInfo } =
      buildRequestContextFromHeaders(request.raw);

    const contextData: RequestContextData = {
      requestId,
      traceId,
      ip,
      userAgent,
      startTime: Date.now(),
      deviceInfo,
    };

    if (!reply.getHeader('X-Request-ID')) {
      reply.header('X-Request-ID', requestId);
    }
    if (traceId && !reply.getHeader('X-Trace-ID')) {
      reply.header('X-Trace-ID', traceId);
    }

    return RequestContextService.run(contextData, () => next.handle());
  }
}
