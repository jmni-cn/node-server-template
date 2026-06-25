/**
 * 异步流程工具 — 纯函数，零依赖。
 *
 * 统一 sleep / 超时包装 / 指数退避重试，供 worker、queue、SSO provider、
 * 健康检查等需要节流、限时、瞬时故障重试的场景复用，
 * 避免各处重复手写 `setTimeout` / `AbortController` / 重试循环。
 */

/** Promise 超时错误（被 {@link withTimeout} 抛出）。 */
export class TimeoutError extends Error {
  constructor(message = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * 暂停指定毫秒（不阻塞事件循环）。
 *
 * @example
 * ```typescript
 * await sleep(1000); // 等待 1s
 * ```
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 为 Promise 增加超时上限：超时后以 {@link TimeoutError} 拒绝。
 *
 * 注意：仅控制等待时间，不会取消底层操作。若底层支持取消，
 * 请额外配合 `AbortController`（fetch / DB 等）。
 *
 * @example
 * ```typescript
 * const data = await withTimeout(fetchUserInfo(), 5000, 'fetchUserInfo timed out');
 * ```
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message?: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

/** {@link retry} 选项。 */
export interface RetryOptions {
  /** 最大尝试次数（含首次），默认 3。 */
  retries?: number;
  /** 初始重试间隔（毫秒），默认 200。 */
  delayMs?: number;
  /** 退避因子（每次间隔乘以该值），默认 2（指数退避）。 */
  factor?: number;
  /** 单次间隔上限（毫秒），默认 5000。 */
  maxDelayMs?: number;
  /** 判定某次错误是否可重试，默认全部重试。 */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** 每次准备重试前回调（用于打日志 / 埋点）。 */
  onRetry?: (error: unknown, attempt: number, nextDelayMs: number) => void;
}

/**
 * 带指数退避的异步重试。
 *
 * 仅建议用于**幂等**操作（读取、可重放写入、外部依赖瞬时抖动）；
 * 非幂等写操作请谨慎使用，避免重复副作用。
 *
 * @example
 * ```typescript
 * const result = await retry(() => provider.fetchUserInfo(token), {
 *   retries: 3,
 *   delayMs: 200,
 *   shouldRetry: (err) => !(err instanceof BusinessException),
 *   onRetry: (err, attempt, delay) =>
 *     logger.warn(`retry #${attempt} after ${delay}ms`, { error: String(err) }),
 * });
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    retries = 3,
    delayMs = 200,
    factor = 2,
    maxDelayMs = 5000,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let currentDelay = delayMs;
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !shouldRetry(error, attempt)) {
        throw error;
      }
      const nextDelay = Math.min(currentDelay, maxDelayMs);
      onRetry?.(error, attempt, nextDelay);
      await sleep(nextDelay);
      currentDelay *= factor;
    }
  }

  // 理论不可达：循环内要么 return 要么 throw。
  throw lastError;
}
