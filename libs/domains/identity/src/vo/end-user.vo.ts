import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '../entities/user-status.enum';
import { UserProfileVo } from './user-profile.vo';

/** 终端用户基础视图对象。 */
export class EndUserVo {
  @ApiProperty({ description: '用户 UID' })
  uid: string;

  @ApiProperty({ description: '用户名', nullable: true })
  username: string | null;

  @ApiProperty({ description: '邮箱', nullable: true })
  email: string | null;

  @ApiProperty({ description: '手机号', nullable: true })
  phone: string | null;

  @ApiProperty({ description: '展示昵称', nullable: true })
  nickname: string | null;

  @ApiProperty({ description: '用户状态', enum: UserStatus })
  status: UserStatus;

  @ApiProperty({ description: '最后登录时间', nullable: true })
  lastLoginAt: Date | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}

/** 终端用户详情视图对象（含资料）。 */
export class EndUserDetailVo extends EndUserVo {
  @ApiProperty({
    description: '用户资料',
    type: () => UserProfileVo,
    nullable: true,
  })
  profile: UserProfileVo | null;
}
