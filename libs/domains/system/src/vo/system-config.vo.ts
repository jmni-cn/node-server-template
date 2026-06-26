import { ApiProperty } from '@nestjs/swagger';
import { SystemConfigType } from '@platform/config';

/**
 * 系统配置视图对象（后台管理壳）。
 *
 * 机密项（isSecret=true）的 value 在 mapper 中脱敏为 null，避免后台泄露敏感值。
 */
export class SystemConfigVo {
  @ApiProperty({ description: '配置UID' })
  uid: string;

  @ApiProperty({ description: '配置键' })
  key: string;

  @ApiProperty({
    description: '配置值（文本；机密项已脱敏为 null）',
    nullable: true,
  })
  value: string | null;

  @ApiProperty({ description: '值类型', enum: SystemConfigType })
  type: SystemConfigType;

  @ApiProperty({ description: '配置分组' })
  group: string;

  @ApiProperty({ description: '配置描述', nullable: true })
  description: string | null;

  @ApiProperty({ description: '展示标签', nullable: true })
  label: string | null;

  @ApiProperty({ description: '是否启用' })
  enabled: boolean;

  @ApiProperty({ description: '是否机密（机密项 value 已脱敏）' })
  isSecret: boolean;

  @ApiProperty({ description: '是否可对外公开' })
  isPublic: boolean;

  @ApiProperty({ description: '是否允许后台编辑（false 表示只读）' })
  isEditable: boolean;
}
