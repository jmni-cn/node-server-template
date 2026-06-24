import { ApiProperty } from '@nestjs/swagger';

/** 当前管理员信息 VO。 */
export class AdminProfileVo {
  @ApiProperty({ description: '用户 UID' })
  uid: string;

  @ApiProperty({ description: '用户名', nullable: true })
  username: string | null;

  @ApiProperty({ description: '角色 UID 列表', type: [String] })
  roleUids: string[];

  @ApiProperty({ description: '权限编码列表', type: [String] })
  permissionCodes: string[];
}
