/**
 * 加密安全的随机值工具。
 *
 * 基于 Node `crypto`（非 `Math.random`），用于生成 OAuth state / nonce、
 * 验证码等需要不可预测性的随机值。
 */
import { randomInt, randomBytes } from 'crypto';

const ALNUM_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * 生成加密安全的随机字符串（字母 + 数字）。
 *
 * 适用于 OAuth state、nonce 等场景。
 *
 * @param length 字符串长度，默认 32
 * @returns 随机字符串
 */
export function generateSecureToken(length: number = 32): string {
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += ALNUM_CHARS[bytes[i] % ALNUM_CHARS.length];
  }
  return result;
}

/**
 * 生成加密安全的纯数字验证码。
 *
 * 使用 `crypto.randomInt`（非 `Math.random`），适用于短信 / 邮件验证码。
 *
 * @param length 验证码长度，默认 6
 * @returns 数字验证码字符串
 */
export function generateNumericCode(length: number = 6): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += String(randomInt(0, 10));
  }
  return result;
}
