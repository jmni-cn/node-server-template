import { ApiProperty } from '@nestjs/swagger';
import { DictionaryItemStatus } from '../entities/dictionary-item.entity';

/** 字典项视图对象。 */
export class DictionaryItemVo {
  @ApiProperty({ description: '字典项UID' })
  uid: string;

  @ApiProperty({ description: '字典项标签' })
  label: string;

  @ApiProperty({ description: '字典项值' })
  value: string;

  @ApiProperty({ description: '排序（升序）' })
  sort: number;

  @ApiProperty({ description: '状态', enum: DictionaryItemStatus })
  status: DictionaryItemStatus;
}
