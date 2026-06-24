/**
 * 系统域缓存常量。
 *
 * NAMESPACE 用于 CacheService 的 namespace 参数，TTL 单位为秒。
 */
export const SYSTEM_CACHE = {
  /** 缓存命名空间 */
  NAMESPACE: 'system',
  /** 系统配置缓存 TTL（秒） */
  CONFIG_TTL: 300,
  /** 字典项缓存 TTL（秒） */
  DICT_TTL: 300,
} as const;
