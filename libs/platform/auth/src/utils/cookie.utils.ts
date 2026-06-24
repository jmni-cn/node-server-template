/**
 * Refresh Token HttpOnly Cookie 工具函数。
 *
 * 统一管理 refresh_token Cookie 的写入与清除，供 user-api / admin-api 等
 * 应用层共用。与具体配置类型解耦：调用方传入 {@link RefreshCookieOptions}，
 * 由应用层从自身配置映射，避免本 lib 反向依赖某个应用的配置接口。
 */
import type { FastifyReply } from 'fastify';
import '@fastify/cookie'; // 模块增强，使 FastifyReply 获得 setCookie / clearCookie 类型

/** refresh_token cookie 名称常量，所有调用方必须使用此值，保证一致性。 */
export const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';

/**
 * Refresh Token Cookie 配置（与具体应用配置类型解耦）。
 */
export interface RefreshCookieOptions {
  /** 是否仅 HTTPS（生产应为 true） */
  secure: boolean;
  /** SameSite 策略 */
  sameSite: 'lax' | 'strict' | 'none';
  /** Cookie 作用域，跨子域时配置 */
  domain?: string;
  /** Cookie 路径，默认 '/' */
  path?: string;
  /** 显式 maxAge（秒）；未提供时从 JWT exp 推导，再回退 7 天 */
  maxAgeSeconds?: number;
}

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

/**
 * 从 JWT exp 字段推导剩余有效期（秒）；解析失败返回 undefined。
 */
function deriveMaxAgeFromToken(refreshToken: string): number | undefined {
  try {
    const payload = JSON.parse(
      Buffer.from(refreshToken.split('.')[1], 'base64url').toString(),
    ) as { exp?: number };
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
      return payload.exp - Math.floor(Date.now() / 1000);
    }
  } catch {
    // decode 失败时返回 undefined，由调用方回退
  }
  return undefined;
}

/**
 * 将 Refresh Token 写入 HttpOnly Cookie。
 *
 * maxAge 优先取 `opts.maxAgeSeconds`，否则从 JWT exp 推导，最终回退 7 天，
 * 与 token 实际有效期保持一致。
 */
export function setRefreshTokenCookie(
  res: FastifyReply,
  refreshToken: string,
  opts: RefreshCookieOptions,
): void {
  const maxAge =
    opts.maxAgeSeconds ??
    deriveMaxAgeFromToken(refreshToken) ??
    SEVEN_DAYS_SECONDS;

  res.setCookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: opts.secure,
    sameSite: opts.sameSite,
    domain: opts.domain,
    path: opts.path ?? '/',
    maxAge,
  });
}

/**
 * 清除 Refresh Token Cookie（用于登出）。
 *
 * path / domain 必须与 {@link setRefreshTokenCookie} 一致，否则浏览器不会删除。
 */
export function clearRefreshTokenCookie(
  res: FastifyReply,
  opts: RefreshCookieOptions,
): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: opts.secure,
    sameSite: opts.sameSite,
    domain: opts.domain,
    path: opts.path ?? '/',
  });
}
