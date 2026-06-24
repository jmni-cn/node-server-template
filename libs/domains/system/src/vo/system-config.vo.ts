import { ApiProperty } from '@nestjs/swagger';
import { SystemConfigType } from '../entities/system-config.entity';

/** 系统配置视图对象。 */
export class SystemConfigVo {
  @ApiProperty({ description: '配置UID' })
  uid: string;

  @ApiProperty({ description: '配置键' })
  key: string;

  @ApiProperty({ description: '配置值（文本）', nullable: true })
  value: string | null;

  @ApiProperty({ description: '值类型', enum: SystemConfigType })
  type: SystemConfigType;

  @ApiProperty({ description: '配置分组' })
  group: string;

  @ApiProperty({ description: '配置描述', nullable: true })
  description: string | null;
}
