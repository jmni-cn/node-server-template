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
}

/**
 * 任务查询参数。
 */
export interface TaskQueryParams {
  type?: string;
  status?: TaskStatus;
  page?: number;
  pageSize?: number;
}
