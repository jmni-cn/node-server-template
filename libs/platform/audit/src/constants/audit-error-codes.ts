/**
 * Audit 业务错误码及其 HTTP 状态映射。
 */

import { HttpStatus } from '@nestjs/common';

export enum AuditErrorCode {
  OP_LOG_NOT_FOUND = 'OP_LOG_NOT_FOUND',
  OP_LOG_CREATE_FAILED = 'OP_LOG_CREATE_FAILED',
}

/**
 * 错误码 → HTTP 状态映射，由 AuditModule 通过 registerErrorCodeHttpStatus 注册。
 */
export const AuditErrorCodeHttpStatus: Record<string, number> = {
  [AuditErrorCode.OP_LOG_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [AuditErrorCode.OP_LOG_CREATE_FAILED]: HttpStatus.INTERNAL_SERVER_ERROR,
};
