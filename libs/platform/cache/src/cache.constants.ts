/**
 * @platform/cache 常量与注入令牌。
 */

/** ioredis 客户端注入令牌。 */
export const REDIS_CLIENT = 'PLATFORM_REDIS_CLIENT';

/** 默认命名空间分隔符。 */
export const CACHE_KEY_SEPARATOR = ':';

/**
 * 空值占位哨兵（防穿透）。当 factory 返回 null/undefined 时写入该标记，
 * 用以区分「已知不存在（命中占位）」与「真正未命中（Redis 无 key）」。
 *
 * 选用极不可能与业务 JSON 撞车的字符串。读取时严格全等匹配。
 */
export const CACHE_NULL_SENTINEL = '__CACHE_NULL__';

/**
 * 空值占位默认 TTL（秒，防穿透）。
 *
 * 远短于正常缓存 TTL，避免热点不存在的 key 反复击穿到 DB，
 * 同时保证后续真实写入能较快生效（占位过期后回源）。
 */
export const CACHE_NULL_TTL_SECONDS = 30;

/**
 * 默认 TTL 抖动比例（防雪崩）。实际写入 TTL = base * (1 ± 该比例 * random)。
 * 0.1 表示在基准 TTL 上下浮动 10%，打散大量 key 的同时过期。
 */
export const CACHE_TTL_JITTER_RATIO = 0.1;
