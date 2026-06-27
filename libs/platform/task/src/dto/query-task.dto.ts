import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '@core/common';
import { TaskStatus } from '../constants';
import type { TaskQueryParams, TaskListParams } from '../types';

/**
 * 任务列表查询 DTO。
 */
export class QueryTaskDto extends PaginationDto {
  @ApiPropertyOptional({ description: '任务类型（通用字符串）' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: '任务状态', enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ description: '业务类型' })
  @IsOptional()
  @IsString()
  bizType?: string;

  @ApiPropertyOptional({ description: '业务 UID' })
  @IsOptional()
  @IsString()
  bizUid?: string;

  @ApiPropertyOptional({ description: '幂等键' })
  @IsOptional()
  @IsString()
  dedupKey?: string;

  /**
   * 转换为简单查询参数（TaskQueryService.query 用，保留模板能力）。
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

  /**
   * 转换为多维过滤分页参数（TaskService.listTasks 用）。
   */
  toListParams(): TaskListParams {
    return {
      type: this.type,
      status: this.status,
      bizType: this.bizType,
      bizUid: this.bizUid,
      dedupKey: this.dedupKey,
      page: this.page,
      pageSize: this.pageSize,
      sortBy: this.sortBy,
      sortOrder: this.order,
    };
  }
}
