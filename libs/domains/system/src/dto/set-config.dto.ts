import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { SystemConfigType } from '@platform/config';

/** 设置（创建或更新）系统配置 DTO。 */
export class SetConfigDto {
  @ApiProperty({ description: '配置键（全局唯一）', maxLength: 128 })
  @IsString()
  @Length(1, 128)
  key: string;

  @ApiProperty({ description: '配置值（文本，可为空）', nullable: true })
  @IsOptional()
  @IsString()
  value: string | null;

  @ApiPropertyOptional({
    description: '值类型',
    enum: SystemConfigType,
    default: SystemConfigType.STRING,
  })
  @IsOptional()
  @IsEnum(SystemConfigType)
  type?: SystemConfigType;

  @ApiPropertyOptional({
    description: '配置分组',
    default: 'default',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  group?: string;

  @ApiPropertyOptional({ description: '配置描述', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    description: '是否启用（禁用后该 DB 覆盖失效，读取回落到 env/代码默认）',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: '展示标签', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @ApiPropertyOptional({ description: '排序（升序）', default: 0 })
  @IsOptional()
  @IsInt()
  sort?: number;
}
