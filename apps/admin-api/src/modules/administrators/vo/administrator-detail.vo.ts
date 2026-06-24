import { ApiProperty } from '@nestjs/swagger';
import { AdminUserVo } from '@domains/identity';

/** 管理员详情 VO（基础信息 + 已绑定角色 UID 列表）。 */
export class AdministratorDetailVo extends AdminUserVo {
  @ApiProperty({ description: '已绑定角色 UID 列表', type: [String] })
  roleUids: string[];
}
