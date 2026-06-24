/**
 * 通用业务错误码占位枚举。
 *
 * @description core 层不绑定任何具体业务域。各业务 lib 应定义自己的
 * `*-error-codes.ts` 枚举并通过 `registerErrorCodeHttpStatus` 注册 HTTP 映射。
 * 这里仅提供最小化的通用业务错误码，避免 core 引用被移除的业务域错误码。
 */
export enum CommonBusinessErrorCode {
  /** 不允许执行此操作 */
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
}

/**
 * 通用业务错误码对应的 HTTP 状态码。
 */
export const CommonBusinessErrorCodeHttpStatus: Record<
  CommonBusinessErrorCode,
  number
> = {
  [CommonBusinessErrorCode.OPERATION_NOT_ALLOWED]: 403,
};
