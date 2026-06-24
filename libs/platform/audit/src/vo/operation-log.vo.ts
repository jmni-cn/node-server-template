/**
 * 操作日志 VO。
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 操作日志详情 VO。
 */
export class OperationLogDetailVo {
  @ApiProperty({ description: '日志UID', example: '202312abcd1234' })
  uid: string;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: '请求唯一标识',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  requestId: string | null;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: '会话标识 (JWT ID)',
    example: '202312sess1234',
  })
  jti: string | null;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: '操作者标识 (Subject)',
    example: '202312user1234',
  })
  actorId: string | null;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: '操作者名称',
    example: 'admin',
  })
  actorName: string | null;

  @ApiProperty({ description: '操作行为', example: 'CREATE_USER' })
  action: string;

  @ApiProperty({ description: '操作模块', example: 'Users' })
  module: string;

  @ApiProperty({ description: '请求方法', example: 'POST' })
  method: string;

  @ApiProperty({ description: '请求路径', example: '/users' })
  path: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: '请求参数',
    example: { username: 'test' },
  })
  params: object | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: '响应结果',
    example: { uid: '202312test1234', username: 'test' },
  })
  result: object | null;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: '请求IP',
    example: '192.168.1.1',
  })
  ip: string | null;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: '用户代理',
    example: 'Mozilla/5.0...',
  })
  userAgent: string | null;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: '设备类型',
    example: 'desktop',
    enum: ['desktop', 'mobile', 'tablet', 'bot', 'unknown'],
  })
  deviceType: string | null;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: '浏览器',
    example: 'Chrome',
  })
  browser: string | null;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: '浏览器版本',
    example: '120.0.0',
  })
  browserVersion: string | null;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: '操作系统',
    example: 'Windows',
  })
  os: string | null;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: '操作系统版本',
    example: '10',
  })
  osVersion: string | null;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: '国家',
    example: 'CN',
  })
  country: string | null;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: '地区/省份',
    example: 'Beijing',
  })
  region: string | null;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: '城市',
    example: 'Beijing',
  })
  city: string | null;

  @ApiProperty({ description: '操作状态: success/failed', example: 'success' })
  status: string;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: '错误码',
    example: 'USER_NOT_FOUND',
  })
  errorCode: string | null;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: '错误信息',
    example: '用户不存在',
  })
  errorMessage: string | null;

  @ApiPropertyOptional({
    type: 'number',
    nullable: true,
    description: '响应耗时（毫秒）',
    example: 120,
  })
  durationMs: number | null;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description: '创建时间',
  })
  createdAt: Date;
}

/**
 * 操作日志列表项 VO。
 */
export class OperationLogListItemVo {
  @ApiProperty({ description: '日志UID', example: '202312abcd1234' })
  uid: string;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: '操作者名称',
    example: 'admin',
  })
  actorName: string | null;

  @ApiProperty({ description: '操作行为', example: 'CREATE_USER' })
  action: string;

  @ApiProperty({ description: '操作模块', example: 'Users' })
  module: string;

  @ApiProperty({ description: '请求方法', example: 'POST' })
  method: string;

  @ApiProperty({ description: '请求路径', example: '/users' })
  path: string;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: '请求IP',
    example: '192.168.1.1',
  })
  ip: string | null;

  @ApiProperty({ description: '操作状态: success/failed', example: 'success' })
  status: string;

  @ApiPropertyOptional({
    type: 'number',
    nullable: true,
    description: '响应耗时（毫秒）',
    example: 120,
  })
  durationMs: number | null;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description: '创建时间',
  })
  createdAt: Date;
}
