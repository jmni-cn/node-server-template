/**
 * Identity 业务错误码及其 HTTP 状态映射。
 */

import { HttpStatus } from '@nestjs/common';

export enum IdentityErrorCode {
  /** 用户不存在 */
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  /** 管理员不存在 */
  ADMIN_NOT_FOUND = 'ADMIN_NOT_FOUND',
  /** 终端用户不存在 */
  END_USER_NOT_FOUND = 'END_USER_NOT_FOUND',
  /** 凭证无效（用户名/邮箱/手机号或密码错误，登录通用错误） */
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  /** 用户名已被占用 */
  USER_USERNAME_TAKEN = 'USER_USERNAME_TAKEN',
  /** 邮箱已被占用 */
  USER_EMAIL_TAKEN = 'USER_EMAIL_TAKEN',
  /** 手机号已被占用 */
  USER_PHONE_TAKEN = 'USER_PHONE_TAKEN',
  /** 用户已被禁用 */
  USER_DISABLED = 'USER_DISABLED',
  /** 用户凭证不存在 */
  USER_CREDENTIAL_NOT_FOUND = 'USER_CREDENTIAL_NOT_FOUND',
  /** 密码错误 */
  USER_PASSWORD_INCORRECT = 'USER_PASSWORD_INCORRECT',
  /** 用户资料不存在 */
  USER_PROFILE_NOT_FOUND = 'USER_PROFILE_NOT_FOUND',
  /** 会话不存在 */
  USER_SESSION_NOT_FOUND = 'USER_SESSION_NOT_FOUND',
  /** 外部身份不存在 */
  USER_EXTERNAL_IDENTITY_NOT_FOUND = 'USER_EXTERNAL_IDENTITY_NOT_FOUND',
  /** 外部身份已绑定到其他用户 */
  USER_EXTERNAL_IDENTITY_LINKED = 'USER_EXTERNAL_IDENTITY_LINKED',
  /** 账户因连续登录失败被临时锁定 */
  USER_LOCKED = 'USER_LOCKED',
  /** 解绑会导致无任何可用登录方式（密码 + 外部身份均无） */
  CANNOT_UNLINK_LAST_LOGIN_METHOD = 'CANNOT_UNLINK_LAST_LOGIN_METHOD',
  /** 外部账号绑定必须经由 SSO 授权回调，禁止直接信任客户端传入的 providerUserId */
  EXTERNAL_LINK_MUST_USE_OAUTH = 'EXTERNAL_LINK_MUST_USE_OAUTH',

  // ============ 会话 / 刷新令牌安全 ============
  /** 会话无效（不存在 / 已撤销 / 不匹配） */
  SESSION_INVALID = 'SESSION_INVALID',
  /** 会话已过期 */
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  /** 检测到 refresh token 重放（疑似令牌盗用） */
  REFRESH_REUSE_DETECTED = 'REFRESH_REUSE_DETECTED',
  /** refresh token 与会话记录不匹配（疑似篡改） */
  TOKEN_INVALID = 'TOKEN_INVALID',
  /** 密码版本不匹配（密码已修改，旧令牌失效） */
  PASSWORD_VERSION_MISMATCH = 'PASSWORD_VERSION_MISMATCH',
  /** 账户不可用（禁用 / 锁定 / 封禁） */
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
}

/**
 * 错误码 → HTTP 状态映射，由 IdentityModule 通过 registerErrorCodeHttpStatus 注册。
 */
export const IdentityErrorCodeHttpStatus: Record<string, number> = {
  [IdentityErrorCode.USER_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [IdentityErrorCode.ADMIN_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [IdentityErrorCode.END_USER_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [IdentityErrorCode.INVALID_CREDENTIALS]: HttpStatus.UNAUTHORIZED,
  [IdentityErrorCode.USER_CREDENTIAL_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [IdentityErrorCode.USER_PROFILE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [IdentityErrorCode.USER_SESSION_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [IdentityErrorCode.USER_EXTERNAL_IDENTITY_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [IdentityErrorCode.USER_USERNAME_TAKEN]: HttpStatus.CONFLICT,
  [IdentityErrorCode.USER_EMAIL_TAKEN]: HttpStatus.CONFLICT,
  [IdentityErrorCode.USER_PHONE_TAKEN]: HttpStatus.CONFLICT,
  [IdentityErrorCode.USER_EXTERNAL_IDENTITY_LINKED]: HttpStatus.CONFLICT,
  [IdentityErrorCode.CANNOT_UNLINK_LAST_LOGIN_METHOD]: HttpStatus.CONFLICT,
  [IdentityErrorCode.EXTERNAL_LINK_MUST_USE_OAUTH]: HttpStatus.BAD_REQUEST,
  [IdentityErrorCode.USER_DISABLED]: HttpStatus.FORBIDDEN,
  [IdentityErrorCode.USER_LOCKED]: HttpStatus.FORBIDDEN,
  [IdentityErrorCode.USER_PASSWORD_INCORRECT]: HttpStatus.UNAUTHORIZED,

  // 会话 / 刷新令牌安全
  [IdentityErrorCode.SESSION_INVALID]: HttpStatus.UNAUTHORIZED,
  [IdentityErrorCode.SESSION_EXPIRED]: HttpStatus.UNAUTHORIZED,
  [IdentityErrorCode.REFRESH_REUSE_DETECTED]: HttpStatus.UNAUTHORIZED,
  [IdentityErrorCode.TOKEN_INVALID]: HttpStatus.UNAUTHORIZED,
  [IdentityErrorCode.PASSWORD_VERSION_MISMATCH]: HttpStatus.UNAUTHORIZED,
  [IdentityErrorCode.ACCOUNT_DISABLED]: HttpStatus.FORBIDDEN,
};
