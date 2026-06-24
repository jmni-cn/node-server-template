import { HttpStatus } from '@nestjs/common';

/**
 * 任务模块业务错误码。
 */
export enum TaskErrorCode {
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_INVALID_STATE = 'TASK_INVALID_STATE',
  TASK_MAX_ATTEMPTS = 'TASK_MAX_ATTEMPTS',
  TASK_ENQUEUE_FAILED = 'TASK_ENQUEUE_FAILED',
}

/**
 * 错误码到 HTTP 状态码的映射，供 registerErrorCodeHttpStatus 注册。
 */
export const TaskErrorCodeHttpStatus: Record<string, HttpStatus> = {
  [TaskErrorCode.TASK_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [TaskErrorCode.TASK_INVALID_STATE]: HttpStatus.CONFLICT,
  [TaskErrorCode.TASK_MAX_ATTEMPTS]: HttpStatus.CONFLICT,
  [TaskErrorCode.TASK_ENQUEUE_FAILED]: HttpStatus.INTERNAL_SERVER_ERROR,
};
