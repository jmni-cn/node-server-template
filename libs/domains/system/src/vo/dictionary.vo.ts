import { ApiProperty } from '@nestjs/swagger';
import { DictionaryItemVo } from './dictionary-item.vo';

/** 字典视图对象。 */
export class DictionaryVo {
  @ApiProperty({ description: '字典UID' })
  uid: string;

  @ApiProperty({ description: '字典编码' })
  code: string;

  @ApiProperty({ description: '字典名称' })
  name: string;

  @ApiProperty({ description: '字典描述', nullable: true })
  description: string | null;
}

/** 字典详情视图对象（含字典项）。 */
export class DictionaryDetailVo extends DictionaryVo {
  @ApiProperty({ description: '字典项列表', type: [DictionaryItemVo] })
  items: DictionaryItemVo[];
}
