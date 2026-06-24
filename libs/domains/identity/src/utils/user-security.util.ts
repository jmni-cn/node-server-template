/**
 * 身份域安全相关纯函数工具。
 *
 * 无副作用、无 DI，可在 service 层复用。
 */

import { createHash } from 'crypto';

/**
 * 计算 refresh token 明文的 SHA256（hex）。
 *
 * 会话表只存哈希（tokenHash），刷新时用入参明文重新哈希后与库内比对，
 * 既能识别篡改，也避免明文落库。
 *
 * @param token refresh token 明文
 * @returns 64 位十六进制哈希
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
