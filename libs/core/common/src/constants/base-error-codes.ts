/**
 * 基础错误码 - 通用业务错误
 * @description 所有模块共用的基础错误码
 */
export enum BaseErrorCode {
  // ============ 系统级错误 (SYS_) ============
  /** 未知错误 */
  SYS_UNKNOWN = 'SYS_UNKNOWN',
  /** 服务内部错误 */
  SYS_INTERNAL = 'SYS_INTERNAL',
  /** 服务不可用 */
  SYS_UNAVAILABLE = 'SYS_UNAVAILABLE',
  /** 请求超时 */
  SYS_TIMEOUT = 'SYS_TIMEOUT',
  /** 数据库错误（底层 driver 错误仅入日志，不外泄） */
  SYS_DB_ERROR = 'SYS_DB_ERROR',

  // ============ 请求级错误 (REQ_) ============
  /** 请求参数验证失败 */
  REQ_VALIDATION_FAILED = 'REQ_VALIDATION_FAILED',
  /** 请求体格式错误 */
  REQ_INVALID_BODY = 'REQ_INVALID_BODY',
  /** 缺少必要参数 */
  REQ_MISSING_PARAM = 'REQ_MISSING_PARAM',
  /** 参数类型错误 */
  REQ_INVALID_PARAM_TYPE = 'REQ_INVALID_PARAM_TYPE',
  /** 参数值不合法（值在类型正确的前提下不满足业务约束） */
  REQ_PARAM_INVALID = 'REQ_PARAM_INVALID',

  // ============ 资源级错误 (RES_) ============
  /** 资源不存在 */
  RES_NOT_FOUND = 'RES_NOT_FOUND',
  /** 资源已存在 */
  RES_ALREADY_EXISTS = 'RES_ALREADY_EXISTS',
  /** 资源冲突 */
  RES_CONFLICT = 'RES_CONFLICT',
  /** 资源已被删除 */
  RES_DELETED = 'RES_DELETED',
  /** 资源正在使用中 */
  RES_IN_USE = 'RES_IN_USE',

  // ============ 操作级错误 (OP_) ============
  /** 操作失败 */
  OP_FAILED = 'OP_FAILED',
  /** 操作不允许 */
  OP_NOT_ALLOWED = 'OP_NOT_ALLOWED',
  /** 操作已过期 */
  OP_EXPIRED = 'OP_EXPIRED',

  // ============ 认证级错误 (AUTH_) ============
  /** 未授权 */
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED',
  /** 登录失败 */
  AUTH_LOGIN_FAILED = 'AUTH_LOGIN_FAILED',
  /** 密码错误 */
  AUTH_PASSWORD_INCORRECT = 'AUTH_PASSWORD_INCORRECT',
  /** 用户已禁用 */
  AUTH_USER_DISABLED = 'AUTH_USER_DISABLED',
  /** IP已被封禁 */
  AUTH_IP_BLOCKED = 'AUTH_IP_BLOCKED',
  /** 验证码已过期 */
  AUTH_CODE_EXPIRED = 'AUTH_CODE_EXPIRED',
  /** 验证码错误 */
  AUTH_CODE_INVALID = 'AUTH_CODE_INVALID',
  /** Token已过期 */
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  /** Token无效 */
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
}

/**
 * 基础错误码对应的 HTTP 状态码
 */
export const BaseErrorCodeHttpStatus: Record<BaseErrorCode, number> = {
  // 系统级错误
  [BaseErrorCode.SYS_UNKNOWN]: 500,
  [BaseErrorCode.SYS_INTERNAL]: 500,
  [BaseErrorCode.SYS_UNAVAILABLE]: 503,
  [BaseErrorCode.SYS_TIMEOUT]: 504,
  [BaseErrorCode.SYS_DB_ERROR]: 500,

  // 请求级错误
  [BaseErrorCode.REQ_VALIDATION_FAILED]: 400,
  [BaseErrorCode.REQ_INVALID_BODY]: 400,
  [BaseErrorCode.REQ_MISSING_PARAM]: 400,
  [BaseErrorCode.REQ_INVALID_PARAM_TYPE]: 400,
  [BaseErrorCode.REQ_PARAM_INVALID]: 400,

  // 资源级错误
  [BaseErrorCode.RES_NOT_FOUND]: 404,
  [BaseErrorCode.RES_ALREADY_EXISTS]: 409,
  [BaseErrorCode.RES_CONFLICT]: 409,
  [BaseErrorCode.RES_DELETED]: 410,
  [BaseErrorCode.RES_IN_USE]: 409,

  // 操作级错误
  [BaseErrorCode.OP_FAILED]: 500,
  [BaseErrorCode.OP_NOT_ALLOWED]: 403,
  [BaseErrorCode.OP_EXPIRED]: 410,

  // 认证级错误
  [BaseErrorCode.AUTH_UNAUTHORIZED]: 401,
  [BaseErrorCode.AUTH_LOGIN_FAILED]: 401,
  [BaseErrorCode.AUTH_PASSWORD_INCORRECT]: 401,
  [BaseErrorCode.AUTH_USER_DISABLED]: 403,
  [BaseErrorCode.AUTH_IP_BLOCKED]: 403,
  [BaseErrorCode.AUTH_CODE_EXPIRED]: 400,
  [BaseErrorCode.AUTH_CODE_INVALID]: 400,
  [BaseErrorCode.AUTH_TOKEN_EXPIRED]: 401,
  [BaseErrorCode.AUTH_TOKEN_INVALID]: 401,
};
