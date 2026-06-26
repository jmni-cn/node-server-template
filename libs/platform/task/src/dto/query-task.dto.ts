import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '@core/common';
import { TaskStatus } from '../constants';
import type { TaskQueryParams } from '../types';

/**
 * 任务列表查询 DTO。
 */
export class QueryTaskDto extends PaginationDto {
  @ApiPropertyOptional({ description: '任务类型' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: '任务状态', enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  /**
   * 转换为服务层查询参数。
   */
  toQueryParams(): TaskQueryParams {
    return {
      type: this.type,
      status: this.status,
      page: this.page,
      pageSize: this.pageSize,
      sortBy: this.sortBy,
      order: this.order,
    };
  }
}
