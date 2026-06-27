import type { TaskStatus } from '../constants';

/**
 * 创建任务的输入参数（通用富任务引擎）。
 *
 * `type` 为通用字符串，业务含义由调用方定义；模板不内置任何业务枚举。
 */
export interface CreateTaskInput {
  /** 任务类型（通用字符串）。 */
  type: string;
  /** 任务名称（可选，模板兼容字段）。 */
  name?: string;
  /** 业务类型（可选）。 */
  bizType?: string;
  /** 业务 UID（可选）。 */
  bizUid?: string;
  /** 优先级（越大越优先，默认 0）。 */
  priority?: number;
  /** 最大尝试次数（默认 3）。 */
  maxAttempt?: number;
  /**
   * 幂等键（可选）：相同 dedupKey 的重复创建会被 DB 唯一约束拦截并幂等返回，
   * 并以 task.uid 作为队列 jobId 实现跨完成态去重。
   */
  dedupKey?: string;
  /** 目标版本（可选）。 */
  targetVersion?: string;
  /** 请求版本（可选）。 */
  requestedVersion?: string;
  /** 依赖任务 UID（可选）。 */
  dependsOnTaskUid?: string;
  /** 队列名（可选）。 */
  queueName?: string;
  /** 计划执行时间（可选）。 */
  scheduledAt?: Date;
  /** 输入数据（任务负载，可选）。 */
  inputJson?: Record<string, unknown>;
  /** 来源类型（通用字符串，可选）。 */
  sourceType?: string;
  /** 链路追踪 ID（可选）。 */
  traceId?: string;
}

/**
 * 任务管理操作上下文（取消 / 重试 / 跳过等人工操作时携带）。
 */
export interface TaskOperationContext {
  /** 操作原因（写入 errorMessage / 审计）。 */
  reason?: string;
  /** 操作人 UID。 */
  operatorUid?: string;
}

/**
 * 任务多维过滤分页查询参数（管理端 listTasks 用）。
 */
export interface TaskListParams {
  /** 任务类型（通用字符串）。 */
  type?: string;
  status?: TaskStatus;
  bizType?: string;
  bizUid?: string;
  dedupKey?: string;
  lockedBy?: string;
  createdStartAt?: Date;
  createdEndAt?: Date;
  updatedStartAt?: Date;
  updatedEndAt?: Date;
  page?: number;
  pageSize?: number;
  /** 排序字段（service 内白名单映射列名）。 */
  sortBy?: string;
  /** 排序方向（默认 DESC）。 */
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * 任务列表查询参数（TaskQueryService.query / VO 列表用，保留模板原结构）。
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
