import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
  Optional,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { I18nService } from 'nestjs-i18n';
import { BusinessException } from '../exceptions/business.exception';
import { BaseErrorCode } from '../constants/base-error-codes';
import { LoggerService } from '@core/logger';
import { RequestContextService } from '@core/request-context';

/**
 * 全局异常过滤器。
 * 捕获所有异常并转换为统一响应格式，支持 i18n 国际化错误消息。
 *
 * LoggerService 与 RequestContextService 均为 @Optional 注入，
 * 缺失时过滤器仍可工作（仅丢失日志/上下文增强）。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @Optional()
    @Inject(I18nService)
    private readonly i18n: I18nService | null,
    @Optional()
    @Inject(LoggerService)
    private readonly logger: LoggerService | null,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const path = request.url;
    const requestId =
      (request.headers['x-request-id'] as string) ||
      RequestContextService.getRequestId();
    const traceId =
      (request.headers['x-trace-id'] as string) ||
      RequestContextService.getTraceId() ||
      requestId;
    const lang = this.getLanguage(request);

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode: string = BaseErrorCode.SYS_UNKNOWN;
    let message = '';
    let details: unknown = null;

    if (exception instanceof BusinessException) {
      // 业务异常
      status = exception.getStatus();
      errorCode = exception.getErrorCode();
      details = exception.getDetails();
      message = this.translateError(errorCode, lang);
    } else if (exception instanceof HttpException) {
      // HTTP 异常
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (status >= 500) {
        // 5xx 服务端错误：不暴露内部细节给前端，仅记录日志
        errorCode = BaseErrorCode.SYS_UNKNOWN;
        message = this.translateError(errorCode, lang);
        this.logger?.error('Internal server error', exception);
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const res = exceptionResponse as Record<string, unknown>;
        // 处理 class-validator 验证错误
        if (Array.isArray(res.message)) {
          errorCode = BaseErrorCode.REQ_VALIDATION_FAILED;
          message = this.translateError(errorCode, lang);
          details = res.message;
        } else {
          message = (res.message as string) || exception.message;
          if (res.errorCode) {
            errorCode = res.errorCode as string;
          }
        }
      }
    } else if (this.isTypeOrmError(exception)) {
      // TypeORM 数据库错误：映射为业务可读错误码；driverError 仅入日志不外泄。
      ({ status, errorCode } = this.mapTypeOrmError(exception));
      message = this.translateError(errorCode, lang);
      this.logger?.error('Database error', {
        name: (exception as Error).name,
        message: (exception as Error).message,
        // driverError（含 SQL / 参数 / 约束细节）仅记录日志，不写入响应。
        driverError: this.extractDriverError(exception),
      });
    } else if (exception instanceof Error) {
      // 其他错误：不暴露内部细节
      message = this.translateError(BaseErrorCode.SYS_UNKNOWN, lang);
      this.logger?.error('Unhandled exception', exception);
    }

    // 默认消息
    if (!message) {
      message = this.translateError(errorCode, lang);
    }

    /** 标准错误响应结构，包含 traceId 用于全链路追踪 */
    const errorResponse = {
      success: false,
      code: errorCode,
      message,
      data: details,
      timestamp: Date.now(),
      path,
      requestId,
      traceId,
    };

    // 记录错误日志（包含 traceId 便于全链路追踪）
    this.logger?.error(`[${status}] ${path}`, {
      errorCode,
      message,
      details,
      traceId,
      requestId,
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    response.status(status).send(errorResponse);
  }

  /**
   * 获取请求语言。
   */
  private getLanguage(request: FastifyRequest): string {
    const acceptLanguage = request.headers['accept-language'];
    if (acceptLanguage) {
      const lang = acceptLanguage.split(',')[0].split(';')[0].trim();
      if (lang === 'zh' || lang.startsWith('zh-')) {
        return 'zh-CN';
      }
      return 'en';
    }
    return 'zh-CN';
  }

  /**
   * 翻译错误消息（i18n key：error.<CODE>）。
   */
  private translateError(code: string, lang: string): string {
    if (!this.i18n) {
      return code;
    }
    try {
      const translated = this.i18n.translate(`error.${code}`, { lang });
      return translated || code;
    } catch {
      return code;
    }
  }

  /**
   * 是否为 TypeORM 抛出的数据库错误。
   *
   * core/common 不直接依赖 typeorm（避免反向耦合），改用 `name` 标识收窄：
   * `QueryFailedError` / `EntityNotFoundError` / `CannotCreateEntityIdMapError` 等
   * TypeORM 错误类的实例 name 均以这些固定值命名。
   */
  private isTypeOrmError(exception: unknown): exception is Error {
    if (!(exception instanceof Error)) {
      return false;
    }
    return (
      exception.name === 'QueryFailedError' ||
      exception.name === 'EntityNotFoundError' ||
      exception.name === 'CannotCreateEntityIdMapError' ||
      // QueryFailedError 携带 driverError；用于兜底识别被包装的查询错误。
      'driverError' in exception
    );
  }

  /**
   * 将 TypeORM 错误映射为 (status, errorCode)：
   * - 唯一约束冲突（MySQL ER_DUP_ENTRY / errno 1062）→ 409 RES_ALREADY_EXISTS；
   * - EntityNotFoundError → 404 RES_NOT_FOUND；
   * - 其余 DB 错误 → 500 SYS_DB_ERROR。
   */
  private mapTypeOrmError(exception: Error): {
    status: number;
    errorCode: string;
  } {
    if (exception.name === 'EntityNotFoundError') {
      return { status: HttpStatus.NOT_FOUND, errorCode: BaseErrorCode.RES_NOT_FOUND };
    }

    const driver = this.extractDriverError(exception);
    if (driver) {
      const code = typeof driver.code === 'string' ? driver.code : undefined;
      const errno = typeof driver.errno === 'number' ? driver.errno : undefined;
      // MySQL/MariaDB 唯一约束冲突。
      if (code === 'ER_DUP_ENTRY' || errno === 1062) {
        return {
          status: HttpStatus.CONFLICT,
          errorCode: BaseErrorCode.RES_ALREADY_EXISTS,
        };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: BaseErrorCode.SYS_DB_ERROR,
    };
  }

  /** 提取 QueryFailedError 的底层 driverError（仅用于日志，不外泄）。 */
  private extractDriverError(
    exception: unknown,
  ): { code?: unknown; errno?: unknown; message?: unknown } | null {
    if (exception && typeof exception === 'object' && 'driverError' in exception) {
      const driver = (exception as { driverError?: unknown }).driverError;
      if (driver && typeof driver === 'object') {
        return driver as { code?: unknown; errno?: unknown; message?: unknown };
      }
    }
    return null;
  }
}
