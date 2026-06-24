import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@core/common';
import { UserStatus } from '../entities/user-status.enum';

/** 用户列表查询入参。 */
export class ListUserDto extends PaginationDto {
  @ApiPropertyOptional({ description: '关键字（用户名/邮箱模糊匹配）' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '用户状态', enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
