import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { UserStatus } from '@domains/identity';

/** 更新管理员入参（基础信息 + 状态）。 */
export class UpdateAdministratorDto {
  @ApiPropertyOptional({ description: '邮箱', maxLength: 255 })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ description: '账户状态', enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
