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
import { BusinessException, DataMaskingUtil } from '@core/common';
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

    // 登录类接口（密码登录 / SSO）请求时通常无 user，落库操作人初始为 null，
    // 成功后需从响应或 RequestContext 回填 sub/username。
    const isOAuthSso =
      metadata.module === 'OAuth' &&
      (metadata.action.includes('SSO') || metadata.action.includes('登录'));
    const isAuthLogin =
      metadata.module === 'Auth' && metadata.action.includes('登录');

    return next.handle().pipe(
      tap((result) => {
        const duration = Date.now() - startTime;

        // 默认沿用 base 中的操作人信息与参数
        let sub = base.sub;
        let username = base.username;
        let params = base.params;
        let resultValue: object | null;

        const res = result as Record<string, unknown> | null;
        const resData = res?.data as Record<string, unknown> | undefined;

        if (isOAuthSso) {
          // SSO 登录：参数仅保留 provider，剔除 code/state 等敏感值
          params = {
            provider:
              (request.params as { provider?: string })?.provider ?? null,
          };

          if (res && res.code === 'OK' && resData && 'sub' in resData) {
            // POST callback：从标准响应体提取操作人
            const oauthData = resData as { sub?: string; username?: string };
            sub = oauthData.sub ?? sub;
            username = oauthData.username ?? username;
            resultValue = this.sanitizeOAuthLoginResult(oauthData);
          } else {
            // GET 重定向（@Res()）：响应体非标准，从 RequestContext 回填
            const updatedCtx = RequestContextService.getContext();
            if (updatedCtx?.sub) {
              sub = updatedCtx.sub;
              username = updatedCtx.username ?? username;
              resultValue = {
                sub: updatedCtx.sub,
                username: updatedCtx.username ?? null,
              };
            } else {
              resultValue = null;
            }
          }
        } else if (
          isAuthLogin &&
          res &&
          res.code === 'OK' &&
          resData?.accessToken
        ) {
          // 密码登录：从 accessToken 解码回填操作人，token 结果用占位符替换
          const decoded = this.decodeJwtPayload(resData.accessToken as string);
          if (decoded) {
            sub = (decoded.sub as string) ?? sub;
            username = (decoded.username as string) ?? username;
          }
          resultValue = this.sanitizeAuthLoginResult();
        } else {
          resultValue = this.sanitizeResult(result);
        }

        const jobData: OperationLogJobData = {
          ...base,
          sub,
          username,
          params,
          result: resultValue,
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
   * 清理请求参数：深拷贝后复用 DataMaskingUtil.redactSensitiveKeys 脱敏
   * （password / token / secret / code 等敏感字段一律替换为占位符）。
   */
  private sanitizeParams(params: object): object | null {
    try {
      const cloned = JSON.parse(JSON.stringify(params)) as Record<
        string,
        unknown
      >;
      return DataMaskingUtil.redactSensitiveKeys(cloned);
    } catch {
      return null;
    }
  }

  /**
   * 清理响应结果：脱敏 + 限制大小（过大时仅记录摘要）。
   */
  private sanitizeResult(result: unknown): object | null {
    if (!result) return null;
    try {
      const str = JSON.stringify(result);
      if (str.length > 2000) {
        return { _truncated: true, _size: str.length };
      }
      const parsed = JSON.parse(str) as Record<string, unknown>;
      return DataMaskingUtil.redactSensitiveKeys(parsed);
    } catch {
      return null;
    }
  }

  /**
   * SSO 登录结果脱敏：仅保留审计需要的 sub/username/isNewUser，不落库 token。
   */
  private sanitizeOAuthLoginResult(result: unknown): object | null {
    if (!result || typeof result !== 'object') return null;
    const res = result as Record<string, unknown>;
    return {
      sub: res.sub ?? null,
      username: res.username ?? null,
      isNewUser: res.isNewUser ?? null,
    };
  }

  /**
   * 密码登录结果脱敏：不落库 accessToken / refreshToken，用占位符替换。
   */
  private sanitizeAuthLoginResult(): object {
    return { _note: 'tokens_omitted' };
  }

  /**
   * 从 JWT accessToken 解码 payload（仅 Base64 解码，不做签名校验）。
   */
  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
      return JSON.parse(payload) as Record<string, unknown>;
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
