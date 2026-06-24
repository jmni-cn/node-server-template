/**
 * AccessCheckService — ACCESS_CHECKER 端口实现。
 *
 * 实现 @platform/auth 的 AccessChecker 接口，供 PermissionsGuard 判定权限。
 * 通过 RoleService 解析用户权限码（带缓存）。
 */

import { Injectable } from '@nestjs/common';
import { type AccessChecker } from '@platform/auth';
import { RoleService } from './role.service';

@Injectable()
export class AccessCheckService implements AccessChecker {
  constructor(private readonly roleService: RoleService) {}

  /**
   * 判断用户是否拥有给定的全部权限。
   * 空权限列表视为通过。
   */
  async hasPermissions(userId: string, perms: string[]): Promise<boolean> {
    if (!perms.length) return true;
    const codes = await this.roleService.getPermissionCodesForUser(userId);
    return perms.every((p) => codes.includes(p));
  }
}
