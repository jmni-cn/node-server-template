import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodeHttpStatus } from '../constants/error-codes';
import { BaseErrorCode } from '../constants/base-error-codes';
import { CommonBusinessErrorCode } from '../constants/common-business-error-codes';

/**
 * 业务异常类。
 * 用于抛出业务逻辑相关的错误，HTTP 状态码从可扩展的 ErrorCodeHttpStatus 注册表解析。
 *
 * @example
 * ```typescript
 * import { BaseErrorCode } from '@core/common';
 *
 * throw new BusinessException(BaseErrorCode.RES_NOT_FOUND);
 * throw new BusinessException('USER_NOT_FOUND'); // 业务 lib 自定义错误码
 * ```
 */
export class BusinessException extends HttpException {
  public readonly errorCode: string;
  public readonly details: unknown;

  constructor(code: string, details?: unknown) {
    const status = ErrorCodeHttpStatus[code] || HttpStatus.BAD_REQUEST;

    super(
      {
        errorCode: code,
        details,
      },
      status,
    );
    this.errorCode = code;
    this.details = details;
  }

  /**
   * 获取错误码
   */
  getErrorCode(): string {
    return this.errorCode;
  }

  /**
   * 获取错误详情
   */
  getDetails(): unknown {
    return this.details;
  }
}

/**
 * 判断是否为 core 层已知错误码（BaseErrorCode / CommonBusinessErrorCode）。
 *
 * 注意：业务 lib 自定义错误码不在此判断范围内（core 不感知业务域）。
 */
export function isKnownErrorCode(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return (
    Object.values(BaseErrorCode).includes(value as BaseErrorCode) ||
    Object.values(CommonBusinessErrorCode).includes(
      value as CommonBusinessErrorCode,
    )
  );
}
