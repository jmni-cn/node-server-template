/**
 * OperationLogInterceptor — 操作日志拦截器。
 *
 * 捕获带有 @OperationLogDecorator 标记的接口的请求/响应，构建 job 负载并入队到 AUDIT 队列，
 * 由 worker 通过 OperationLogService.persistFromJob 落库。
 * 审计入队失败不影响主请求。
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import type { FastifyRequest } from 'fastify';
import { RequestContextService } from '@core/request-context';
import { LoggerService } from '@core/logger';
import { BusinessException } from '@core/common';
import { QueueProducer, QUEUE_NAMES, JOB_NAMES } from '@platform/queue';
import type { OperationLogJobData } from '@platform/queue';
import {
  OPERATION_LOG_KEY,
  type OperationLogMetadata,
} from '../decorators/operation-log-meta.decorator';

/**
 * 认证用户接口（兼容 admin-api / user-api）。
 */
interface AuthUser {
  sub?: string;
  jti?: string;
  username?: string;
}

@Injectable()
export class OperationLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly queueProducer: QueueProducer,
    private readonly logger: LoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.get<OperationLogMetadata>(
      OPERATION_LOG_KEY,
      context.getHandler(),
    );

    if (!metadata) {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: AuthUser }>();

    const startTime = RequestContextService.getStartTime() ?? Date.now();
    const deviceInfo = RequestContextService.getDeviceInfo();
    const geoLocation = RequestContextService.getGeoLocation();
    const user = request.user;

    const base = {
      requestId: RequestContextService.getRequestId() ?? null,
      jti: user?.jti ?? RequestContextService.getJti() ?? null,
      sub: user?.sub ?? RequestContextService.getSub() ?? null,
      username: user?.username ?? RequestContextService.getUsername() ?? null,

      action: metadata.action,
      module: metadata.module,
      method: request.method,
      path: request.url,
      params: this.sanitizeParams({
        body: request.body,
        query: request.query,
        params: request.params,
      }),

      ip: RequestContextService.getIp() ?? null,
      userAgent: RequestContextService.getUserAgent() ?? null,
      deviceType: deviceInfo?.deviceType ?? null,
      browser: deviceInfo?.browser ?? null,
      browserVersion: deviceInfo?.browserVersion ?? null,
      os: deviceInfo?.os ?? null,
      osVersion: deviceInfo?.osVersion ?? null,

      country: geoLocation?.country ?? null,
      region: geoLocation?.region ?? null,
      city: geoLocation?.city ?? null,
    };

    return next.handle().pipe(
      tap((result) => {
        const duration = Date.now() - startTime;
        const jobData: OperationLogJobData = {
          ...base,
          result: this.sanitizeResult(result),
          success: true,
          errorCode: null,
          errorMessage: null,
          duration,
        };
        void this.enqueue(jobData);
      }),
      catchError((error: unknown) => {
        const duration = Date.now() - startTime;
        const jobData: OperationLogJobData = {
          ...base,
          result: null,
          success: false,
          errorCode: this.extractErrorCode(error),
          errorMessage: this.extractErrorMessage(error),
          duration,
        };
        void this.enqueue(jobData);
        throw error;
      }),
    );
  }

  /**
   * 入队，失败不影响主请求。
   */
  private async enqueue(jobData: OperationLogJobData): Promise<void> {
    try {
      await this.queueProducer.enqueue(
        QUEUE_NAMES.AUDIT,
        JOB_NAMES.AUDIT.WRITE_OPERATION_LOG,
        jobData,
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue operation log: ${(error as Error).message}`,
      );
    }
  }

  /**
   * 清理请求参数，避免序列化失败。
   */
  private sanitizeParams(params: object): object | null {
    try {
      return JSON.parse(JSON.stringify(params)) as object;
    } catch {
      return null;
    }
  }

  /**
   * 清理响应结果（避免过大）。
   */
  private sanitizeResult(result: unknown): object | null {
    if (!result) return null;
    try {
      const str = JSON.stringify(result);
      if (str.length > 2000) {
        return { _truncated: true, _size: str.length };
      }
      return JSON.parse(str) as object;
    } catch {
      return null;
    }
  }

  /**
   * 提取错误码。
   */
  private extractErrorCode(error: unknown): string {
    if (error instanceof BusinessException) {
      return error.getErrorCode();
    }
    const e = error as { code?: string; name?: string } | null;
    return e?.code ?? e?.name ?? 'UNKNOWN_ERROR';
  }

  /**
   * 提取错误信息。
   */
  private extractErrorMessage(error: unknown): string | null {
    const message = (error as Error)?.message;
    return message ? message.substring(0, 500) : null;
  }
}
