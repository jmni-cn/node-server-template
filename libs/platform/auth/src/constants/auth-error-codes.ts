/**
 * 认证授权错误码
 * @description 用于认证、授权、会话管理相关的错误。
 *
 * 仅包含与平台认证基础设施相关的错误组：
 * - AUTH_  认证错误
 * - TOKEN_ 令牌错误
 * - SESSION_ 会话错误
 * - PWD_  密码错误
 * - PERM_ 授权错误
 *
 * 邮箱验证码（EMAIL_）与第三方登录（OAUTH_）属于 domain/integration 关注点，
 * 不在本平台库范围内。
 */
export enum AuthErrorCode {
  // ============ 认证错误 (AUTH_) ============
  /** 未认证 */
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED',
  /** 凭据无效（用户名/密码错误） */
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  /** 账户已禁用 */
  AUTH_ACCOUNT_DISABLED = 'AUTH_ACCOUNT_DISABLED',
  /** 账户已锁定 */
  AUTH_ACCOUNT_LOCKED = 'AUTH_ACCOUNT_LOCKED',
  /** 账户未激活 */
  AUTH_ACCOUNT_INACTIVE = 'AUTH_ACCOUNT_INACTIVE',

  // ============ Token 错误 (TOKEN_) ============
  /** Access Token 已过期 */
  TOKEN_ACCESS_EXPIRED = 'TOKEN_ACCESS_EXPIRED',
  /** Access Token 无效 */
  TOKEN_ACCESS_INVALID = 'TOKEN_ACCESS_INVALID',
  /** Refresh Token 已过期 */
  TOKEN_REFRESH_EXPIRED = 'TOKEN_REFRESH_EXPIRED',
  /** Refresh Token 无效 */
  TOKEN_REFRESH_INVALID = 'TOKEN_REFRESH_INVALID',
  /** Token 格式错误 */
  TOKEN_MALFORMED = 'TOKEN_MALFORMED',
  /** Token 签名无效 */
  TOKEN_SIGNATURE_INVALID = 'TOKEN_SIGNATURE_INVALID',

  // ============ 会话错误 (SESSION_) ============
  /** 会话不存在 */
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  /** 会话已过期 */
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  /** 会话已被撤销 */
  SESSION_REVOKED = 'SESSION_REVOKED',
  /** 超过最大设备数限制 */
  SESSION_DEVICE_LIMIT = 'SESSION_DEVICE_LIMIT',

  // ============ 密码错误 (PWD_) ============
  /** 密码错误 */
  PWD_INCORRECT = 'PWD_INCORRECT',
  /** 密码强度不足 */
  PWD_TOO_WEAK = 'PWD_TOO_WEAK',
  /** 密码已过期 */
  PWD_EXPIRED = 'PWD_EXPIRED',
  /** 新密码与旧密码相同 */
  PWD_SAME_AS_OLD = 'PWD_SAME_AS_OLD',
  /** 密码版本不匹配（密码已更改） */
  PWD_VERSION_MISMATCH = 'PWD_VERSION_MISMATCH',

  // ============ 授权错误 (PERM_) ============
  /** 权限不足 */
  PERM_DENIED = 'PERM_DENIED',
  /** 角色不存在 */
  PERM_ROLE_NOT_FOUND = 'PERM_ROLE_NOT_FOUND',
  /** 权限不存在 */
  PERM_NOT_FOUND = 'PERM_NOT_FOUND',
  /** 角色已存在 */
  PERM_ROLE_EXISTS = 'PERM_ROLE_EXISTS',
  /** 权限编码已存在 */
  PERM_CODE_EXISTS = 'PERM_CODE_EXISTS',
  /** 角色正在使用中 */
  PERM_ROLE_IN_USE = 'PERM_ROLE_IN_USE',
}

/**
 * 认证错误码对应的 HTTP 状态码。
 *
 * 由 AuthModule 调用 `registerErrorCodeHttpStatus` 注册到全局映射。
 */
export const AuthErrorCodeHttpStatus: Record<AuthErrorCode, number> = {
  // 认证错误
  [AuthErrorCode.AUTH_UNAUTHORIZED]: 401,
  [AuthErrorCode.AUTH_INVALID_CREDENTIALS]: 401,
  [AuthErrorCode.AUTH_ACCOUNT_DISABLED]: 403,
  [AuthErrorCode.AUTH_ACCOUNT_LOCKED]: 403,
  [AuthErrorCode.AUTH_ACCOUNT_INACTIVE]: 403,

  // Token 错误
  [AuthErrorCode.TOKEN_ACCESS_EXPIRED]: 401,
  [AuthErrorCode.TOKEN_ACCESS_INVALID]: 401,
  [AuthErrorCode.TOKEN_REFRESH_EXPIRED]: 401,
  [AuthErrorCode.TOKEN_REFRESH_INVALID]: 401,
  [AuthErrorCode.TOKEN_MALFORMED]: 401,
  [AuthErrorCode.TOKEN_SIGNATURE_INVALID]: 401,

  // 会话错误
  [AuthErrorCode.SESSION_NOT_FOUND]: 401,
  [AuthErrorCode.SESSION_EXPIRED]: 401,
  [AuthErrorCode.SESSION_REVOKED]: 401,
  [AuthErrorCode.SESSION_DEVICE_LIMIT]: 403,

  // 密码错误
  [AuthErrorCode.PWD_INCORRECT]: 401,
  [AuthErrorCode.PWD_TOO_WEAK]: 400,
  [AuthErrorCode.PWD_EXPIRED]: 403,
  [AuthErrorCode.PWD_SAME_AS_OLD]: 400,
  [AuthErrorCode.PWD_VERSION_MISMATCH]: 401,

  // 授权错误
  [AuthErrorCode.PERM_DENIED]: 403,
  [AuthErrorCode.PERM_ROLE_NOT_FOUND]: 404,
  [AuthErrorCode.PERM_NOT_FOUND]: 404,
  [AuthErrorCode.PERM_ROLE_EXISTS]: 409,
  [AuthErrorCode.PERM_CODE_EXISTS]: 409,
  [AuthErrorCode.PERM_ROLE_IN_USE]: 409,
};
