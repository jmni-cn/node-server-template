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
import { LoggerService } from '@core/logger';
import { RequestContextService } from '@core/request-context';

/**
 * 健康检查 / 探活类路径：被 Docker healthcheck、k8s 探针、LB 等高频访问，
 * 成功日志属于噪音，默认不记录（仍记录出错日志）。
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

/** 慢请求阈值（毫秒）：响应耗时超过该值时以 warn 级别记录并打 slow 标记。 */
const SLOW_REQUEST_THRESHOLD_MS = 1000;

/**
 * 请求日志拦截器。
 * 记录每个请求的基本信息和响应时间，从 RequestContextService (AsyncLocalStorage)
 * 获取 requestId 和 ip（由 RequestContext 中间件/拦截器预先设置）。
 *
 * 健康检查类路径默认跳过成功日志以减少噪音，但仍保留出错日志。
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Optional()
    @Inject(LoggerService)
    private readonly logger: LoggerService | null,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();

    const { method, url } = request;

    // 从 AsyncLocalStorage 上下文获取请求信息
    const requestContext = RequestContextService.getContext();
    const requestId = requestContext?.requestId || 'unknown';
    const userAgent = requestContext?.userAgent || '';
    const startTime = requestContext?.startTime || Date.now();

    // 确保 requestId 也存储到请求对象（兼容旧代码）
    (request as FastifyRequest & { requestId?: string }).requestId = requestId;

    // 确保响应头包含 requestId（中间件可能已设置）
    if (!response.getHeader('X-Request-ID')) {
      response.header('X-Request-ID', requestId);
    }

    // 健康检查类路径跳过成功日志（仍保留出错日志），避免探活高频刷屏
    const skipSuccessLog = isHealthCheckPath(url);

    if (!skipSuccessLog) {
      this.logger?.log(`--> ${method} ${url}`, {
        userAgent: userAgent.substring(0, 100),
      });
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - startTime;
          // 慢请求：即便是健康检查路径也记录，便于发现性能退化。
          if (responseTime > SLOW_REQUEST_THRESHOLD_MS) {
            this.logger?.warn(
              `<-- ${method} ${url} ${responseTime}ms [slow]`,
              { responseTime, slow: true },
            );
            return;
          }
          if (skipSuccessLog) return;
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
