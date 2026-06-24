/**
 * 错误码聚合模块
 *
 * 设计原则：
 * 1. core 层只提供 BaseErrorCode（系统/请求/资源/操作/认证级通用错误码）
 *    以及一个最小化的 CommonBusinessErrorCode 占位枚举。
 * 2. 各业务 lib 定义自己的 `*-error-codes.ts` 枚举，并在初始化时通过
 *    `registerErrorCodeHttpStatus(map)` 把自己的 code→HTTP status 映射注册进来。
 * 3. 每个错误码对应一个 i18n key：`error.{ERROR_CODE}`。
 */

export { BaseErrorCode, BaseErrorCodeHttpStatus } from './base-error-codes';
export {
  CommonBusinessErrorCode,
  CommonBusinessErrorCodeHttpStatus,
} from './common-business-error-codes';

import { BaseErrorCodeHttpStatus } from './base-error-codes';
import { CommonBusinessErrorCodeHttpStatus } from './common-business-error-codes';

/**
 * 统一错误码 HTTP 状态码映射（可扩展注册表）。
 *
 * 初始仅聚合 BaseErrorCodeHttpStatus + CommonBusinessErrorCodeHttpStatus。
 * 业务 lib 通过 `registerErrorCodeHttpStatus` 动态扩展，core 不引用任何业务域错误码。
 */
export const ErrorCodeHttpStatus: Record<string, number> = {
  ...BaseErrorCodeHttpStatus,
  ...CommonBusinessErrorCodeHttpStatus,
};

/**
 * 注册额外的错误码 → HTTP 状态映射。
 *
 * @description 供 @platform / @domains / @integrations 等业务 lib 在模块初始化时调用，
 * 把各自定义的错误码 HTTP 映射并入全局注册表。
 * @example
 * ```typescript
 * // 在某个业务模块初始化处
 * import { registerErrorCodeHttpStatus } from '@core/common';
 * import { AuthErrorCodeHttpStatus } from './constants/auth-error-codes';
 * registerErrorCodeHttpStatus(AuthErrorCodeHttpStatus);
 * ```
 */
export function registerErrorCodeHttpStatus(
  mapping: Record<string, number>,
): void {
  Object.assign(ErrorCodeHttpStatus, mapping);
}

/**
 * 根据错误码获取 HTTP 状态码（未注册时回退 400）。
 */
export function getHttpStatusByErrorCode(code: string): number {
  return ErrorCodeHttpStatus[code] ?? 400;
}
