import { ApiProperty } from '@nestjs/swagger';

/** 外部身份视图对象。 */
export class ExternalIdentityVo {
  @ApiProperty({ description: '外部身份 UID' })
  uid: string;

  @ApiProperty({ description: '主体类型: admin/user' })
  subjectType: string;

  @ApiProperty({ description: '身份提供方' })
  provider: string;

  @ApiProperty({ description: '提供方侧用户标识' })
  providerUserId: string;

  @ApiProperty({ description: 'UnionId', nullable: true })
  unionId: string | null;

  @ApiProperty({ description: 'SSO provider 昵称快照', nullable: true })
  providerNickname: string | null;
}
