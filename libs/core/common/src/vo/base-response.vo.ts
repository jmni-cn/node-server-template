import { ApiProperty } from '@nestjs/swagger';

/**
 * 简单成功响应 VO（无具体数据）
 */
export class SuccessVo {
  @ApiProperty({ description: '操作是否成功', example: true })
  success: boolean;
}

/**
 * 统一响应基础结构（仅用于 Swagger schema 定义）
 * 不包含 data 字段，data 由各装饰器单独定义
 */
export class BaseResponseVo<T> {
  @ApiProperty({ description: '请求是否成功', example: true })
  success: boolean;

  @ApiProperty({ description: '业务状态码', example: 'OK' })
  code: string;

  @ApiProperty({ description: '响应消息', example: '操作成功' })
  message: string;

  @ApiProperty({ description: '响应数据' })
  data: T;

  @ApiProperty({ description: '响应时间戳', example: 1702300000000 })
  timestamp: number;

  @ApiProperty({ description: '请求路径', example: '/api/users' })
  path: string;

  @ApiProperty({
    description: '请求ID',
    example: 'uuid-string',
    required: false,
  })
  requestId?: string;

  @ApiProperty({
    description: '链路追踪ID（用于全链路定位问题）',
    example: 'trace-uuid-string',
    required: false,
  })
  traceId?: string;
}

/**
 * BaseResponse 类型接口（用于拦截器等运行时类型）
 */
export interface BaseResponse<T = unknown> {
  success: boolean;
  code: string;
  message: string;
  data: T;
  timestamp: number;
  path: string;
  requestId?: string;
  /** 链路追踪ID（用于全链路定位问题） */
  traceId?: string;
}

/**
 * 错误响应 VO
 *
 * 标准错误响应结构
 * 包含 traceId 用于全链路追踪
 */
export class ErrorResponseVo {
  @ApiProperty({ description: '请求是否成功', example: false })
  success: boolean;

  @ApiProperty({ description: '错误码', example: 'USER_NOT_FOUND' })
  code: string;

  @ApiProperty({ description: '错误消息', example: '用户不存在' })
  message: string;

  @ApiProperty({ description: '响应时间戳', example: 1702300000000 })
  timestamp: number;

  @ApiProperty({ description: '请求路径', example: '/api/users/123' })
  path: string;

  @ApiProperty({
    description: '请求ID',
    example: 'uuid-string',
    required: false,
  })
  requestId?: string;

  @ApiProperty({
    description: '链路追踪ID（用于全链路定位问题）',
    example: 'trace-uuid-string',
    required: false,
  })
  traceId?: string;
}
