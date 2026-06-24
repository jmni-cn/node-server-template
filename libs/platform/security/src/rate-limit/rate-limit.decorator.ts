import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

/**
 * Options controlling how a route is rate limited.
 */
export interface RateLimitOptions {
  /** Sliding window size in milliseconds. */
  windowMs: number;
  /** Maximum number of requests allowed within the window. */
  max: number;
  /**
   * How the limit key is derived.
   * - `ip`: client IP only
   * - `user`: authenticated subject (sub)
   * - `ip-path`: client IP + request path (default)
   */
  keyBy?: 'ip' | 'user' | 'ip-path';
}

/**
 * Rate limiting decorator. Attaches {@link RateLimitOptions} metadata that the
 * {@link RateLimitGuard} reads to enforce per-route limits.
 *
 * @example
 * ```typescript
 * @RateLimit({ windowMs: 60_000, max: 10, keyBy: 'ip' })
 * @Post('login')
 * async login() {}
 * ```
 */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
