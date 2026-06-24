import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@core/common';

export class ListRoleDto extends PaginationDto {
  @ApiPropertyOptional({ description: '关键词（按编码/名称模糊匹配）' })
  @IsOptional()
  @IsString()
  keyword?: string;
}
