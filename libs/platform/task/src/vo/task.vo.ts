import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../constants';

/**
 * 任务详情视图对象。
 */
export class TaskVo {
  @ApiProperty({ description: '任务 UID' })
  uid: string;

  @ApiProperty({ description: '任务名称' })
  name: string;

  @ApiProperty({ description: '任务类型' })
  type: string;

  @ApiProperty({ description: '任务状态', enum: TaskStatus })
  status: TaskStatus;

  @ApiProperty({ description: '已尝试次数' })
  attempts: number;

  @ApiProperty({ description: '最大尝试次数' })
  maxAttempts: number;

  @ApiProperty({ description: '计划执行时间', nullable: true })
  scheduledAt: Date | null;

  @ApiProperty({ description: '开始执行时间', nullable: true })
  startedAt: Date | null;

  @ApiProperty({ description: '执行结束时间', nullable: true })
  finishedAt: Date | null;

  @ApiProperty({ description: '错误信息', nullable: true })
  error: string | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

/**
 * 任务列表项视图对象（精简字段）。
 */
export class TaskListItemVo {
  @ApiProperty({ description: '任务 UID' })
  uid: string;

  @ApiProperty({ description: '任务名称' })
  name: string;

  @ApiProperty({ description: '任务类型' })
  type: string;

  @ApiProperty({ description: '任务状态', enum: TaskStatus })
  status: TaskStatus;

  @ApiProperty({ description: '已尝试次数' })
  attempts: number;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}
