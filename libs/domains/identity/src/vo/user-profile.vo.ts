import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '../entities/user-profile.entity';

/** 用户资料视图对象。 */
export class UserProfileVo {
  @ApiProperty({ description: '昵称', nullable: true })
  nickname: string | null;

  @ApiProperty({ description: '头像 URL', nullable: true })
  avatar: string | null;

  @ApiProperty({ description: '性别', enum: Gender })
  gender: Gender;

  @ApiProperty({ description: '个人简介', nullable: true })
  bio: string | null;
}
