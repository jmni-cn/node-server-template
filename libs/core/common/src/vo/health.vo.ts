import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 健康检查项状态 VO
 */
export class HealthCheckItemVo {
  @ApiProperty({ description: '检查项状态', example: 'healthy' })
  status: string;

  @ApiPropertyOptional({ description: '状态消息', example: 'Connection OK' })
  message?: string;
}

/**
 * 健康检查响应 VO
 */
export class HealthCheckVo {
  @ApiProperty({ description: '服务状态', example: 'healthy' })
  status: string;

  @ApiProperty({
    description: '响应时间戳',
    example: '2026-02-04T12:00:00.000Z',
  })
  timestamp: string;
}

/**
 * 存活探针响应 VO
 */
export class LivenessVo {
  @ApiProperty({ description: '服务状态', example: 'alive' })
  status: string;
}

/**
 * 就绪探针响应 VO
 */
export class ReadinessVo {
  @ApiProperty({ description: '服务状态', example: 'ready' })
  status: string;

  @ApiProperty({
    description: '各检查项状态',
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/HealthCheckItemVo' },
    example: {
      database: { status: 'healthy', message: 'Connection OK' },
      redis: { status: 'healthy', message: 'Connection OK' },
    },
  })
  checks: Record<string, HealthCheckItemVo>;
}
