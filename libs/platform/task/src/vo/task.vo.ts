import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../constants';

/**
 * 任务详情视图对象。
 */
export class TaskVo {
  @ApiProperty({ description: '任务 UID' })
  uid: string;

  @ApiProperty({ description: '任务类型' })
  type: string;

  @ApiProperty({ description: '任务名称', nullable: true })
  name: string | null;

  @ApiProperty({ description: '业务类型', nullable: true })
  bizType: string | null;

  @ApiProperty({ description: '业务 UID', nullable: true })
  bizUid: string | null;

  @ApiProperty({ description: '任务状态', enum: TaskStatus })
  status: TaskStatus;

  @ApiProperty({ description: '优先级（越大越优先）' })
  priority: number;

  @ApiProperty({ description: '已尝试次数' })
  attempt: number;

  @ApiProperty({ description: '最大尝试次数' })
  maxAttempt: number;

  @ApiProperty({ description: '幂等键', nullable: true })
  dedupKey: string | null;

  @ApiProperty({ description: '来源类型', nullable: true })
  sourceType: string | null;

  @ApiProperty({ description: '计划执行时间', nullable: true })
  scheduledAt: Date | null;

  @ApiProperty({ description: '开始执行时间', nullable: true })
  startedAt: Date | null;

  @ApiProperty({ description: '执行结束时间', nullable: true })
  finishedAt: Date | null;

  @ApiProperty({ description: '错误码', nullable: true })
  errorCode: string | null;

  @ApiProperty({ description: '错误信息', nullable: true })
  errorMessage: string | null;

  @ApiProperty({ description: '输出数据', nullable: true })
  outputJson: Record<string, unknown> | null;

  @ApiProperty({ description: '链路追踪 ID', nullable: true })
  traceId: string | null;

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

  @ApiProperty({ description: '任务类型' })
  type: string;

  @ApiProperty({ description: '任务名称', nullable: true })
  name: string | null;

  @ApiProperty({ description: '业务类型', nullable: true })
  bizType: string | null;

  @ApiProperty({ description: '业务 UID', nullable: true })
  bizUid: string | null;

  @ApiProperty({ description: '任务状态', enum: TaskStatus })
  status: TaskStatus;

  @ApiProperty({ description: '优先级' })
  priority: number;

  @ApiProperty({ description: '已尝试次数' })
  attempt: number;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}
