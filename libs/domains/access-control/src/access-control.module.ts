/**
 * AccessControlModule — 访问控制（RBAC）域模块。
 *
 * 聚合角色、权限、菜单及其关联实体与服务，并将 AccessCheckService
 * 绑定到 @platform/auth 的 ACCESS_CHECKER token，供 PermissionsGuard 使用。
 *
 * 仅依赖 @core/* 与 @platform/*（cache / auth token），不依赖任何兄弟域。
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { registerErrorCodeHttpStatus } from '@core/common';
import { CacheModule } from '@platform/cache';
import { ACCESS_CHECKER } from '@platform/auth';

import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { Menu } from './entities/menu.entity';
import { UserRole } from './entities/user-role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { RoleMenu } from './entities/role-menu.entity';

import { PermissionService } from './services/permission.service';
import { MenuService } from './services/menu.service';
import { RoleService } from './services/role.service';
import { AccessCheckService } from './services/access-check.service';
import { RoleAssembler } from './assembler/role.assembler';

import { AccessErrorCodeHttpStatus } from './constants/access-error-codes';

// 模块加载时注册错误码 → HTTP 状态映射。
registerErrorCodeHttpStatus(AccessErrorCodeHttpStatus);

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Role,
      Permission,
      Menu,
      UserRole,
      RolePermission,
      RoleMenu,
    ]),
    CacheModule,
  ],
  providers: [
    PermissionService,
    MenuService,
    RoleService,
    AccessCheckService,
    RoleAssembler,
    // 将 ACCESS_CHECKER 端口绑定到本域的实现，
    // 使 @platform/auth 的 PermissionsGuard 可解析权限检查器。
    { provide: ACCESS_CHECKER, useExisting: AccessCheckService },
  ],
  exports: [
    PermissionService,
    MenuService,
    RoleService,
    AccessCheckService,
    RoleAssembler,
    ACCESS_CHECKER,
    TypeOrmModule,
  ],
})
export class AccessControlModule {}
