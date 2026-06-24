import { customAlphabet } from 'nanoid';

/**
 * UID 生成工具 — 基于 nanoid，使用小写字母 + 数字字符集。
 */
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * 生成指定长度的随机 UID（由小写字母和数字组成）。
 * @param length - UID 长度，默认 10 位
 * @returns 随机 UID 字符串
 * @example
 * ```typescript
 * const uid = generateLowercaseUid(); // "h3b8k9a2m1"
 * const uid8 = generateLowercaseUid(8); // "h4j2k9l5"
 * ```
 */
export function generateLowercaseUid(length: number = 10): string {
  return customAlphabet(ALPHABET, length)();
}

/**
 * 生成带日期前缀的 UID。
 * @param length - UID 长度，默认 8 位
 * @returns 带日期前缀的 UID 字符串
 * @example
 * ```typescript
 * const uid = generateDatePrefixedUid(); // "202311b8k9a2m1"
 * ```
 */
export function generateDatePrefixedUid(length: number = 8): string {
  const datePrefix = new Date().toISOString().slice(0, 7).replace(/-/g, '');
  return `${datePrefix}${generateLowercaseUid(length)}`;
}

/**
 * 生成带前缀的 UID（base entities 使用）。
 * @param prefix - 前缀（业务标识）
 * @param length - UID 长度，默认 10 位
 * @returns 带前缀的 UID 字符串
 * @example
 * ```typescript
 * const uid = generatePrefixedUid('usr'); // "usr_h3b8k9a2m1"
 * ```
 */
export function generatePrefixedUid(
  prefix: string,
  length: number = 10,
): string {
  return `${prefix}_${generateLowercaseUid(length)}`;
}
