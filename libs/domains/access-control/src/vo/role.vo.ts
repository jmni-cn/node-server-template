import { ApiProperty } from '@nestjs/swagger';
import { PermissionVo } from './permission.vo';
import { MenuVo } from './menu.vo';

export class RoleVo {
  @ApiProperty({ description: '角色 UID' })
  uid: string;

  @ApiProperty({ description: '角色编码' })
  code: string;

  @ApiProperty({ description: '角色名称' })
  name: string;

  @ApiProperty({ description: '角色描述', nullable: true })
  description: string | null;

  @ApiProperty({ description: '是否系统内置角色' })
  isSystem: boolean;

  @ApiProperty({ description: '是否启用' })
  enabled: boolean;
}

export class RoleDetailVo extends RoleVo {
  @ApiProperty({ description: '角色拥有的权限', type: [PermissionVo] })
  permissions: PermissionVo[];

  @ApiProperty({ description: '角色授权的菜单', type: [MenuVo] })
  menus: MenuVo[];
}
