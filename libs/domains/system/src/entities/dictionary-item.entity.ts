/**
 * DictionaryItem Entity — 字典项实体。
 *
 * 通过 dictId 关联 Dictionary.uid，承载具体的标签/值/排序/状态。
 */

import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '@core/database';

/** 字典项状态。 */
export enum DictionaryItemStatus {
  /** 启用 */
  ENABLED = 'enabled',
  /** 停用 */
  DISABLED = 'disabled',
}

@Entity('dictionary_items')
@Unique('uq_dictionary_items_dict_value', ['dictId', 'value'])
export class DictionaryItem extends BaseEntity {
  static override uidPrefix = 'ditm';

  @Index()
  @Column({
    type: 'varchar',
    name: 'dict_id',
    length: 32,
    comment: '所属字典UID（引用 Dictionary.uid）',
  })
  dictId: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: '字典项标签（展示文本）',
  })
  label: string;

  @Column({
    type: 'varchar',
    length: 255,
    comment: '字典项值',
  })
  value: string;

  @Column({
    type: 'int',
    default: 0,
    comment: '排序（升序）',
  })
  sort: number;

  @Column({
    type: 'enum',
    enum: DictionaryItemStatus,
    default: DictionaryItemStatus.ENABLED,
    comment: '状态: enabled/disabled',
  })
  status: DictionaryItemStatus;
}
