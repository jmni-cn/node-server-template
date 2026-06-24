import { CACHE_KEY_SEPARATOR } from './cache.constants';

/**
 * 构建带命名空间的缓存 key。
 *
 * @example
 * ```typescript
 * buildKey('user', '123', 'profile'); // "user:123:profile"
 * ```
 */
export function buildKey(
  namespace: string,
  ...parts: Array<string | number>
): string {
  return [namespace, ...parts]
    .filter((p) => p !== undefined && p !== null && p !== '')
    .join(CACHE_KEY_SEPARATOR);
}
