/**
 * 访问控制域错误码 + HTTP 状态映射。
 *
 * 错误码值与键一致；模块加载时通过 `registerErrorCodeHttpStatus`
 * 将 `AccessErrorCodeHttpStatus` 注册进全局注册表。
 */

import { HttpStatus } from '@nestjs/common';

export enum AccessErrorCode {
  RBAC_ROLE_NOT_FOUND = 'RBAC_ROLE_NOT_FOUND',
  RBAC_ROLE_CODE_TAKEN = 'RBAC_ROLE_CODE_TAKEN',
  RBAC_ROLE_IS_SYSTEM = 'RBAC_ROLE_IS_SYSTEM',
  RBAC_PERMISSION_NOT_FOUND = 'RBAC_PERMISSION_NOT_FOUND',
  RBAC_PERMISSION_CODE_TAKEN = 'RBAC_PERMISSION_CODE_TAKEN',
  RBAC_MENU_NOT_FOUND = 'RBAC_MENU_NOT_FOUND',
  RBAC_USER_ROLE_NOT_FOUND = 'RBAC_USER_ROLE_NOT_FOUND',
}

export const AccessErrorCodeHttpStatus: Record<string, number> = {
  [AccessErrorCode.RBAC_ROLE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [AccessErrorCode.RBAC_ROLE_CODE_TAKEN]: HttpStatus.CONFLICT,
  [AccessErrorCode.RBAC_ROLE_IS_SYSTEM]: HttpStatus.FORBIDDEN,
  [AccessErrorCode.RBAC_PERMISSION_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [AccessErrorCode.RBAC_PERMISSION_CODE_TAKEN]: HttpStatus.CONFLICT,
  [AccessErrorCode.RBAC_MENU_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [AccessErrorCode.RBAC_USER_ROLE_NOT_FOUND]: HttpStatus.NOT_FOUND,
};
