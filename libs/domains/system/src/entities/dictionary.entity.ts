/**
 * Dictionary Entity — 字典实体。
 *
 * 字典是一组同类型枚举值的容器（如「订单状态」「性别」），
 * 通过唯一的 code 标识，字典项（DictionaryItem）通过 dictId 关联本实体的 uid。
 */

import { Column, Entity } from 'typeorm';
import { BaseEntity } from '@core/database';

@Entity('dictionaries')
export class Dictionary extends BaseEntity {
  static override uidPrefix = 'dict';

  @Column({
    type: 'varchar',
    length: 64,
    unique: true,
    comment: '字典编码（全局唯一）',
  })
  code: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: '字典名称',
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '字典描述',
  })
  description: string | null;
}
