import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '../entities/user-status.enum';

/** 管理员视图对象。 */
export class AdminUserVo {
  @ApiProperty({ description: '管理员 UID' })
  uid: string;

  @ApiProperty({ description: '用户名' })
  username: string;

  @ApiProperty({ description: '邮箱', nullable: true })
  email: string | null;

  @ApiProperty({ description: '展示昵称', nullable: true })
  nickname: string | null;

  @ApiProperty({ description: '账户状态', enum: UserStatus })
  status: UserStatus;

  @ApiProperty({ description: '最后登录时间', nullable: true })
  lastLoginAt: Date | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}
