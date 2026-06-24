import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/** 修改密码入参。 */
export class ChangePasswordDto {
  @ApiProperty({ description: '旧密码' })
  @IsString()
  @Length(6, 128)
  oldPassword: string;

  @ApiProperty({ description: '新密码', minLength: 6, maxLength: 128 })
  @IsString()
  @Length(6, 128)
  newPassword: string;
}
