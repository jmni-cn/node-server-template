import { ApiProperty } from '@nestjs/swagger';

/** 用户会话视图对象。 */
export class SessionVo {
  @ApiProperty({ description: '会话 UID' })
  uid: string;

  @ApiProperty({ description: '主体类型: admin/user' })
  subjectType: string;

  @ApiProperty({ description: '设备标识', nullable: true })
  device: string | null;

  @ApiProperty({ description: '设备名称', nullable: true })
  deviceName: string | null;

  @ApiProperty({ description: '客户端平台', example: 'web' })
  platform: string;

  @ApiProperty({ description: '登录 IP', nullable: true })
  ip: string | null;

  @ApiProperty({ description: '用户代理', nullable: true })
  userAgent: string | null;

  @ApiProperty({ description: '最后活跃时间', nullable: true })
  lastSeenAt: Date | null;

  @ApiProperty({ description: '过期时间' })
  expiresAt: Date;

  @ApiProperty({ description: '吊销时间', nullable: true })
  revokedAt: Date | null;

  @ApiProperty({ description: '是否为当前会话' })
  current: boolean;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}
