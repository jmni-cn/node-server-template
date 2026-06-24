import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '@core/common';

/** 系统配置分页查询 DTO。 */
export class QueryConfigDto extends PaginationDto {
  @ApiPropertyOptional({ description: '按配置分组过滤', maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  group?: string;

  @ApiPropertyOptional({ description: '按配置键模糊搜索', maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  keyword?: string;
}
