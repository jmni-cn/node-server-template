import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FastifyRequest, FastifyReply } from 'fastify';
import { RequestContextService } from '@core/request-context';
import { LoggerService } from './logger.service';

/**
 * 健康检查 / 探活类路径：高频访问，成功日志属于噪音，默认不记录（仍记录出错日志）。
 */
const HEALTH_CHECK_PATH_SUFFIXES = [
  '/health',
  '/healthz',
  '/ping',
  '/readyz',
  '/livez',
];

function isHealthCheckPath(url: string): boolean {
  const path = (url.split('?')[0] || '').replace(/\/+$/, '');
  return HEALTH_CHECK_PATH_SUFFIXES.some(
    (suffix) => path === suffix || path.endsWith(suffix),
  );
}

/**
 * 请求日志拦截器。
 * 记录每个请求的基本信息和响应时间，requestId/ip 来自 RequestContextService。
 *
 * 与 @core/common 的 LoggingInterceptor 等价；此处放在 @core/logger 便于
 * 仅依赖 logger 的应用直接复用，避免被迫引入 @core/common。
 */
@Injectable()
export class LoggerInterceptor implements NestInterceptor {
  constructor(
    @Optional()
    @Inject(LoggerService)
    private readonly logger: LoggerService | null,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();

    const { method, url } = request;

    const requestContext = RequestContextService.getContext();
    const requestId = requestContext?.requestId || 'unknown';
    const userAgent = requestContext?.userAgent || '';
    const startTime = requestContext?.startTime || Date.now();

    (request as FastifyRequest & { requestId?: string }).requestId = requestId;

    if (!response.getHeader('X-Request-ID')) {
      response.header('X-Request-ID', requestId);
    }

    const skipSuccessLog = isHealthCheckPath(url);

    if (!skipSuccessLog) {
      this.logger?.log(`--> ${method} ${url}`, {
        userAgent: userAgent.substring(0, 100),
      });
    }

    return next.handle().pipe(
      tap({
        next: () => {
          if (skipSuccessLog) return;
          const responseTime = Date.now() - startTime;
          this.logger?.log(`<-- ${method} ${url} ${responseTime}ms`, {
            responseTime,
          });
        },
        error: () => {
          const responseTime = Date.now() - startTime;
          this.logger?.warn(`<-- ${method} ${url} ${responseTime}ms [error]`, {
            responseTime,
          });
        },
      }),
    );
  }
}
