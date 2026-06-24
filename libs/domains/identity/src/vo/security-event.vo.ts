import { ApiProperty } from '@nestjs/swagger';

/** 用户安全事件视图对象。 */
export class SecurityEventVo {
  @ApiProperty({ description: '事件 UID' })
  uid: string;

  @ApiProperty({ description: '主体类型: admin/user', nullable: true })
  subjectType: string | null;

  @ApiProperty({ description: '事件类型', example: 'LOGIN_SUCCESS' })
  eventType: string;

  @ApiProperty({ description: '风险等级', example: 'low' })
  riskLevel: string;

  @ApiProperty({ description: '会话 UID', nullable: true })
  sessionUid: string | null;

  @ApiProperty({ description: '脱敏 IP', nullable: true })
  ipMasked: string | null;

  @ApiProperty({ description: '元数据', nullable: true, type: Object })
  metadata: Record<string, unknown> | null;

  @ApiProperty({ description: '发生时间' })
  createdAt: Date;
}
