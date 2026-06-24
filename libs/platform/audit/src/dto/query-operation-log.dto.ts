/**
 * 查询操作日志 DTO。
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';
import { PaginationDto } from '@core/common';
import type { OperationLogQueryParams } from '../types';

export class QueryOperationLogDto extends PaginationDto {
  @ApiPropertyOptional({ description: '操作模块', example: 'Users' })
  @IsOptional()
  @IsString()
  module?: string;

  @ApiPropertyOptional({ description: '操作行为', example: 'CREATE_USER' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({
    description: '操作者标识 (Subject)',
    example: '202312abcd1234',
  })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({
    description: '操作状态: success/failed',
    example: 'success',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: '开始时间',
    example: '2023-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({
    description: '结束时间',
    example: '2023-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  /**
   * 转换为 OperationLogQueryParams。
   */
  toQueryParams(): OperationLogQueryParams {
    return {
      module: this.module,
      action: this.action,
      actorId: this.actorId,
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime,
      page: this.page,
      pageSize: this.pageSize,
    };
  }
}
