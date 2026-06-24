import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * 权限装饰器
 * 用于标注接口所需的权限（仅适用于 admin-api）。
 *
 * @param permissions 权限编码列表
 *
 * @example
 * ```typescript
 * @Permissions('user.read', 'user.write')
 * @Get('users')
 * getUsers() { ... }
 * ```
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
