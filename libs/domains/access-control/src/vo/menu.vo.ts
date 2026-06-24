import { ApiProperty } from '@nestjs/swagger';
import { MenuType } from '../entities/enums';

export class MenuVo {
  @ApiProperty({ description: '菜单 UID' })
  uid: string;

  @ApiProperty({ description: '父菜单 UID', nullable: true })
  parentId: string | null;

  @ApiProperty({ description: '菜单名称' })
  name: string;

  @ApiProperty({ description: '路由路径', nullable: true })
  path: string | null;

  @ApiProperty({ description: '图标标识', nullable: true })
  icon: string | null;

  @ApiProperty({ description: '排序值' })
  sort: number;

  @ApiProperty({ description: '菜单类型', enum: MenuType })
  type: MenuType;
}

export class MenuTreeVo extends MenuVo {
  @ApiProperty({ description: '子菜单列表', type: () => [MenuTreeVo] })
  children: MenuTreeVo[];
}
