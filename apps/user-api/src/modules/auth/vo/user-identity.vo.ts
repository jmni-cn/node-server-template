import { ApiProperty } from '@nestjs/swagger';

/** 当前用户身份 VO（来自 access token，非完整资料）。 */
export class UserIdentityVo {
  @ApiProperty({ description: '用户 UID' })
  uid: string;

  @ApiProperty({ description: '用户名', nullable: true })
  username: string | null;
}
