import { Module } from '@nestjs/common';
import { AccessControlModule } from '@domains/access-control';
import { RolesController } from './roles.controller';
import { PermissionsController } from './permissions.controller';
import { MenusController } from './menus.controller';

/** 管理后台访问控制（RBAC）模块：角色 / 权限 / 菜单。 */
@Module({
  imports: [AccessControlModule],
  controllers: [RolesController, PermissionsController, MenusController],
})
export class AdminAccessControlModule {}
