import { HttpStatus } from '@nestjs/common';

/**
 * 任务模块业务错误码。
 */
export enum TaskErrorCode {
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_INVALID_STATE = 'TASK_INVALID_STATE',
  TASK_MAX_ATTEMPTS = 'TASK_MAX_ATTEMPTS',
  TASK_ENQUEUE_FAILED = 'TASK_ENQUEUE_FAILED',
  /** 任务运行卡死超时（stale 恢复扫描判定 PROCESSING 任务长时间未完成，且重试耗尽） */
  TASK_STALE_TIMEOUT = 'TASK_STALE_TIMEOUT',
  /** 任务卡死被恢复为可重试（stale 恢复扫描判定卡死，尚有重试次数 → RETRYING） */
  TASK_STALE_RECOVERED = 'TASK_STALE_RECOVERED',
}

/**
 * 错误码到 HTTP 状态码的映射，供 registerErrorCodeHttpStatus 注册。
 */
export const TaskErrorCodeHttpStatus: Record<string, HttpStatus> = {
  [TaskErrorCode.TASK_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [TaskErrorCode.TASK_INVALID_STATE]: HttpStatus.CONFLICT,
  [TaskErrorCode.TASK_MAX_ATTEMPTS]: HttpStatus.CONFLICT,
  [TaskErrorCode.TASK_ENQUEUE_FAILED]: HttpStatus.INTERNAL_SERVER_ERROR,
  // stale 超时为后台兜底产生的失败原因，不直接面向请求，归为服务端错误。
  [TaskErrorCode.TASK_STALE_TIMEOUT]: HttpStatus.INTERNAL_SERVER_ERROR,
  [TaskErrorCode.TASK_STALE_RECOVERED]: HttpStatus.INTERNAL_SERVER_ERROR,
};
