import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DictionaryItemStatus } from '../entities/dictionary-item.entity';

/** 新增字典项 DTO。 */
export class CreateDictionaryItemDto {
  @ApiProperty({ description: '所属字典UID', maxLength: 32 })
  @IsString()
  @Length(1, 32)
  dictId: string;

  @ApiProperty({ description: '字典项标签', maxLength: 100 })
  @IsString()
  @Length(1, 100)
  label: string;

  @ApiProperty({ description: '字典项值', maxLength: 255 })
  @IsString()
  @Length(1, 255)
  value: string;

  @ApiPropertyOptional({ description: '排序（升序）', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort?: number;

  @ApiPropertyOptional({
    description: '状态',
    enum: DictionaryItemStatus,
    default: DictionaryItemStatus.ENABLED,
  })
  @IsOptional()
  @IsEnum(DictionaryItemStatus)
  status?: DictionaryItemStatus;
}
