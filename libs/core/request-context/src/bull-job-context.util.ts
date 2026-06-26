/**
 * Worker 侧请求上下文重建工具。
 *
 * HTTP 请求通过中间件建立 AsyncLocalStorage 上下文（requestId/traceId/sub 等），
 * 但 worker 消费 BullMQ job 时运行在独立的执行栈中，上下文已丢失。
 * 这里提供从 job 负载重建上下文、并在该上下文中执行 handler 的能力，
 * 使 worker 侧日志 / 审计 / 安全事件能继续携带原始链路标识。
 *
 * 设计：仅依赖 job 负载的最小形状（requestId/traceId/...），
 * 不引入 bullmq 类型，保持本 lib 零外部耦合。
 */
import { RequestContextService } from './request-context.service';
import type { RequestContextData } from './request-context.types';
import { generateRequestId } from './request-context.util';

/** job 负载中可携带的上下文字段（由 producer 入队时注入）。 */
export interface BullJobContextPayload {
  requestId?: string | null;
  traceId?: string | null;
  jobUid?: string | null;
  sub?: string | null;
  username?: string | null;
  jti?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** BullMQ Job 的最小形状（避免依赖 bullmq 类型）。 */
interface JobLike {
  id?: string | number | null;
  name?: string;
  data?: unknown;
}

/**
 * 将 BullMQ job 转换为请求上下文数据。
 *
 * 优先复用 job 负载中携带的 requestId/traceId（由 producer 注入），
 * 缺失时回退生成新的 requestId，保证 worker 侧链路始终可追踪。
 */
export function bullJobToRequestContext(job: JobLike): RequestContextData {
  const data = (job?.data ?? {}) as BullJobContextPayload;
  const requestId = data.requestId || generateRequestId();
  const traceId = data.traceId || requestId;

  return {
    requestId,
    traceId,
    jobUid: data.jobUid ?? (job?.id != null ? String(job.id) : undefined),
    sub: data.sub ?? undefined,
    username: data.username ?? undefined,
    jti: data.jti ?? undefined,
    ip: data.ip ?? undefined,
    userAgent: data.userAgent ?? undefined,
    startTime: Date.now(),
  };
}

/**
 * 在由 job 重建的请求上下文中执行回调。
 *
 * @example
 * ```typescript
 * return runWithBullJobContext(job, () => handler(job));
 * ```
 */
export function runWithBullJobContext<T>(
  job: JobLike,
  callback: () => T,
): T {
  const ctx = bullJobToRequestContext(job);
  return RequestContextService.run(ctx, callback);
}
