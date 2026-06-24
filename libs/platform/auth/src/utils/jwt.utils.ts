/**
 * JWT 纯函数工具：过期时间解析与计算。
 *
 * 无副作用、无 DI，可在 service / strategy / 应用层复用。
 */

/**
 * 将过期时间字符串转换为秒数。
 *
 * 支持 s / m / h / d 单位；无法解析时返回默认 900（15 分钟）。
 *
 * @param expiresIn 过期时间字符串，如 '15m' / '1h' / '7d' / '900s'
 * @returns 秒数
 *
 * @example
 * parseExpiresIn('15m') // 900
 * parseExpiresIn('1h')  // 3600
 * parseExpiresIn('7d')  // 604800
 */
export function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // 默认 15 分钟

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      return 900;
  }
}

/**
 * 将秒数转换为毫秒。
 */
export function secondsToMs(seconds: number): number {
  return seconds * 1000;
}

/**
 * 计算过期时间点。
 *
 * @param expiresInSeconds 过期秒数
 * @returns 过期时间 Date 对象
 */
export function calculateExpiresAt(expiresInSeconds: number): Date {
  return new Date(Date.now() + secondsToMs(expiresInSeconds));
}

/**
 * 从 Token 中解析过期时间。
 *
 * @param token JWT token
 * @param decode JWT decode 函数（如 jwtService.decode）
 * @param fallbackSeconds decode 失败时的兜底秒数（默认 30 天）
 * @returns 过期时间 Date 对象
 */
export function getExpiresAtFromToken(
  token: string,
  decode: (token: string) => { exp?: number } | null,
  fallbackSeconds: number = 30 * 24 * 60 * 60, // 30 天
): Date {
  const decoded = decode(token);
  const expSec = decoded?.exp;

  if (typeof expSec === 'number' && Number.isFinite(expSec)) {
    return new Date(expSec * 1000);
  }

  return new Date(Date.now() + fallbackSeconds * 1000);
}
