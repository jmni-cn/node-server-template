import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

/** 创建字典 DTO。 */
export class CreateDictionaryDto {
  @ApiProperty({ description: '字典编码（全局唯一）', maxLength: 64 })
  @IsString()
  @Length(1, 64)
  code: string;

  @ApiProperty({ description: '字典名称', maxLength: 100 })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({ description: '字典描述', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
