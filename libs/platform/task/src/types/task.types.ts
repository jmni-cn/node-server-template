import type { TaskStatus } from '../constants';

/**
 * 创建任务的输入参数。
 */
export interface CreateTaskInput {
  name: string;
  type: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
  scheduledAt?: Date;
  /**
   * 幂等键（可选）：相同 dedupKey 的重复创建会被 DB 唯一约束拦截，
   * 并以 task.uid 作为队列 jobId 实现跨完成态去重。
   */
  dedupKey?: string;
}

/**
 * 任务查询参数。
 */
export interface TaskQueryParams {
  type?: string;
  status?: TaskStatus;
  page?: number;
  pageSize?: number;
  /** 排序字段（由 service 用 assertSortWhitelist 校验白名单） */
  sortBy?: string;
  /** 排序方向（默认 DESC） */
  order?: 'ASC' | 'DESC';
}
