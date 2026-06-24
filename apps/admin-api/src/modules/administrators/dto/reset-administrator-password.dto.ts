import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/** 重置管理员密码入参（管理员代为重置，无需旧密码）。 */
export class ResetAdministratorPasswordDto {
  @ApiProperty({ description: '新明文密码', minLength: 6, maxLength: 128 })
  @IsString()
  @Length(6, 128)
  newPassword: string;
}
