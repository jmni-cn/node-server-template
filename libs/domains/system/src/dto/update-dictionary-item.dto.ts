import { ApiPropertyOptional } from '@nestjs/swagger';
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

/** 更新字典项 DTO。 */
export class UpdateDictionaryItemDto {
  @ApiPropertyOptional({ description: '字典项标签', maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  label?: string;

  @ApiPropertyOptional({ description: '字典项值', maxLength: 255 })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  value?: string;

  @ApiPropertyOptional({ description: '排序（升序）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort?: number;

  @ApiPropertyOptional({ description: '状态', enum: DictionaryItemStatus })
  @IsOptional()
  @IsEnum(DictionaryItemStatus)
  status?: DictionaryItemStatus;
}
