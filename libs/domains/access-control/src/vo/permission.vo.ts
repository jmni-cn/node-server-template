import { ApiProperty } from '@nestjs/swagger';

export class PermissionVo {
  @ApiProperty({ description: '权限 UID' })
  uid: string;

  @ApiProperty({ description: '权限编码', example: 'rbac:user:read' })
  code: string;

  @ApiProperty({ description: '权限名称' })
  name: string;

  @ApiProperty({ description: '权限分组' })
  group: string;
}

export class PermissionGroupVo {
  @ApiProperty({ description: '分组名称' })
  group: string;

  @ApiProperty({ description: '该分组下的权限列表', type: [PermissionVo] })
  permissions: PermissionVo[];
}
