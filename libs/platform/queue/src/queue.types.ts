import type { QueueName } from './queue.constants';

/**
 * @platform/queue — job 负载类型定义。
 */

/** 通用 job 信封：所有入队负载的最小公共字段。 */
export interface BaseJobData {
  /** 触发时携带的请求/链路标识（便于跨进程追踪） */
  requestId?: string | null;
  traceId?: string | null;
}

/** 审计日志 job 负载（与 @platform/audit 的写入入参对应）。 */
export interface OperationLogJobData extends BaseJobData {
  requestId: string | null;
  jti: string | null;
  sub: string | null;
  username: string | null;
  action: string;
  module: string;
  method: string;
  path: string;
  params: object | null;
  result: object | null;
  ip: string | null;
  userAgent: string | null;
  deviceType: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  success: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  duration: number | null;
}

/** 用户事件 job 负载。 */
export interface UserEventJobData extends BaseJobData {
  sub: string;
  username: string | null;
}

/** SSO 同步 job 负载。 */
export interface SsoSyncJobData extends BaseJobData {
  /** 主体类型（决定对账时在 admin/user 域查询外部身份）。 */
  subjectType: 'admin' | 'user';
  provider: string;
  externalId: string;
  sub?: string;
}

/** 通用任务执行 job 负载（与 @platform/task 对应）。 */
export interface TaskJobData extends BaseJobData {
  /** task 实体的 uid */
  taskUid: string;
  /** task 类型 */
  type: string;
  /** 业务负载 */
  payload?: Record<string, unknown>;
}

/** 入队选项（透传给 BullMQ add）。 */
export interface EnqueueOptions {
  /** 延迟毫秒数 */
  delay?: number;
  /** 最大重试次数 */
  attempts?: number;
  /** 退避策略 */
  backoff?: number | { type: string; delay: number };
  /** 自定义 jobId（用于去重） */
  jobId?: string;
  /** 优先级（数值越小越优先） */
  priority?: number;
  /** 完成后是否移除 */
  removeOnComplete?: boolean | number;
  /** 失败后是否移除 */
  removeOnFail?: boolean | number;
}

/** 队列名 → 负载类型映射（便于 producer 处给出类型提示）。 */
export interface QueueJobDataMap {
  audit: OperationLogJobData;
  'user-events': UserEventJobData;
  'sso-sync': SsoSyncJobData;
  task: TaskJobData;
  system: BaseJobData;
}

export type { QueueName };
