/**
 * Audit 操作日志类型定义。
 */

/**
 * 操作日志查询参数。
 */
export interface OperationLogQueryParams {
  /** 操作模块 */
  module?: string;
  /** 操作行为 */
  action?: string;
  /** 操作者标识 (Subject) */
  actorId?: string;
  /** 操作状态: success/failed */
  status?: string;
  /** 开始时间 */
  startTime?: Date | string;
  /** 结束时间 */
  endTime?: Date | string;
  /** 页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 排序字段（由 service 用 assertSortWhitelist 校验白名单） */
  sortBy?: string;
  /** 排序方向（默认 DESC） */
  order?: 'ASC' | 'DESC';
}

/**
 * 创建操作日志的扁平输入。
 */
export interface CreateOperationLogInput {
  // 操作者信息
  actorId: string | null;
  actorName: string | null;

  // 请求信息
  action: string;
  module: string;
  method: string;
  path: string;
  params: object | null;
  result: object | null;

  // 客户端信息
  ip: string | null;
  userAgent: string | null;

  // 响应信息
  status: string;
  durationMs: number | null;
  errorCode: string | null;

  // 可选附加字段
  requestId?: string | null;
  jti?: string | null;
  deviceType?: string | null;
  browser?: string | null;
  browserVersion?: string | null;
  os?: string | null;
  osVersion?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  errorMessage?: string | null;
}
