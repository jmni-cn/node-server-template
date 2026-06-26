/**
 * @platform/auth - JWT Payload 接口定义
 *
 * 设计原则：
 * 1. 遵循 RFC 7519 JWT 标准字段命名：sub, iat, exp, jti
 * 2. 基础接口包含两端共用的核心字段
 * 3. 各应用通过扩展添加专属字段
 * 4. 避免冗余字段（如 uid 和 sub 同时存在）
 *
 * 标准字段说明：
 * - sub (Subject): 用户标识符，这里使用用户 UID
 * - jti (JWT ID): 唯一令牌标识符，这里用作会话 ID
 * - iat (Issued At): 令牌签发时间
 * - exp (Expiration Time): 令牌过期时间
 * - pv: 自定义字段，密码版本号
 * - typ: 自定义字段，令牌类型标识
 */

/**
 * Token 类型枚举
 * @description 用于区分不同端的 Token
 */
export type TokenType = 'admin' | 'user' | 'refresh';

/**
 * 基础 JWT Access Token Payload
 * @description admin-api 和 user-api 共用的核心字段
 */
export interface BaseJwtPayload {
  /** 用户 UID (Subject, RFC 7519) */
  sub: string;
  /** 用户名（可为 null，如第三方登录用户可能没有用户名） */
  username: string | null;
  /** 会话 ID (JWT ID, RFC 7519)，用于会话追踪和撤销 */
  jti: string;
  /** 密码版本号，密码修改后使旧 Token 失效 */
  pv: number;
  /** Token 类型标识 */
  typ: TokenType;
  /** Token 签发时间（自动生成） */
  iat?: number;
  /** Token 过期时间（自动生成） */
  exp?: number;
}

/**
 * 管理后台 JWT Access Token Payload
 * @description 扩展角色和权限信息，用于 RBAC
 */
export interface AdminJwtPayload extends BaseJwtPayload {
  typ: 'admin';
  /** 角色 UID 列表 */
  roleUids: string[];
  /** 权限编码列表 */
  permissionCodes: string[];
}

/**
 * 用户端 JWT Access Token Payload
 * @description 保持简洁，不需要角色权限
 */
export interface UserJwtPayload extends BaseJwtPayload {
  typ: 'user';
}

/**
 * Refresh Token Payload
 * @description 刷新令牌仅包含最小必要信息
 */
export interface RefreshTokenPayload {
  /** 用户 UID */
  sub: string;
  /** 会话 ID，与 Access Token 共享 */
  jti: string;
  /** 密码版本号 */
  pv: number;
  /** 类型标识，固定为 'refresh' */
  typ: 'refresh';
  /** Token 签发时间 */
  iat?: number;
  /** Token 过期时间 */
  exp?: number;
}

// ============================================
// 请求用户信息接口（Token 验证后注入到 request.user）
// ============================================

/**
 * 基础认证用户信息
 * @description Token 验证后注入到 request.user 的信息
 */
export interface BaseAuthUser {
  /** 用户 UID */
  sub: string;
  /** 用户名 */
  username: string | null;
  /** 会话 ID */
  jti: string;
  /** 密码版本号 */
  pv: number;
  /** Token 类型 */
  typ: TokenType;
  /**
   * Token 过期时间（Unix 秒，RFC 7519 exp）。
   * 由策略从 payload 透传，供 logout 按"剩余有效期"精确设置黑名单 TTL 等用途。
   */
  exp?: number;
}

/**
 * 管理后台认证用户信息
 */
export interface AdminAuthUser extends BaseAuthUser {
  typ: 'admin';
  /** 角色 UID 列表 */
  roleUids: string[];
  /** 权限编码列表 */
  permissionCodes: string[];
}

/**
 * 用户端认证用户信息
 */
export interface UserAuthUser extends BaseAuthUser {
  typ: 'user';
}

/**
 * Refresh Token 验证后的用户信息
 */
export interface RefreshAuthUser {
  /** 用户 UID */
  sub: string;
  /** 会话 ID */
  jti: string;
  /** 密码版本号 */
  pv: number;
  /** 类型标识 */
  typ: 'refresh';
  /** 原始 Refresh Token（用于 hash 比对，由 Strategy 层提取） */
  rawToken: string;
}
