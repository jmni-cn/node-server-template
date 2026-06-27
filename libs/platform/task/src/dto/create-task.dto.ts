import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsInt,
  IsObject,
  IsDate,
  Min,
} from 'class-validator';
import type { CreateTaskInput } from '../types';

/**
 * 创建任务请求 DTO。
 *
 * `type` 为通用字符串，业务含义由调用方定义；模板不内置任何业务枚举。
 */
export class CreateTaskDto {
  @ApiProperty({ description: '任务类型（通用字符串）' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ description: '任务名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '业务类型' })
  @IsOptional()
  @IsString()
  bizType?: string;

  @ApiPropertyOptional({ description: '业务 UID' })
  @IsOptional()
  @IsString()
  bizUid?: string;

  @ApiPropertyOptional({ description: '优先级（越大越优先）', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({ description: '最大尝试次数', default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxAttempt?: number;

  @ApiPropertyOptional({ description: '幂等键' })
  @IsOptional()
  @IsString()
  dedupKey?: string;

  @ApiPropertyOptional({ description: '来源类型（通用字符串）' })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional({ description: '输入数据（任务负载）' })
  @IsOptional()
  @IsObject()
  inputJson?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '计划执行时间' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledAt?: Date;

  /**
   * 转换为服务层创建入参。
   */
  toCreateInput(): CreateTaskInput {
    return {
      type: this.type,
      name: this.name,
      bizType: this.bizType,
      bizUid: this.bizUid,
      priority: this.priority,
      maxAttempt: this.maxAttempt,
      dedupKey: this.dedupKey,
      sourceType: this.sourceType,
      inputJson: this.inputJson,
      scheduledAt: this.scheduledAt,
    };
  }
}
