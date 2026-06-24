/**
 * SystemConfig Entity — 系统配置实体。
 *
 * 基于 key 的键值配置，value 以文本存储，按 type 在读取时做类型化解析。
 */

import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@core/database';

/** 系统配置值类型。 */
export enum SystemConfigType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
}

@Entity('system_configs')
export class SystemConfig extends BaseEntity {
  static override uidPrefix = 'cfg';

  @Column({
    type: 'varchar',
    name: 'config_key',
    length: 128,
    unique: true,
    comment: '配置键（全局唯一）',
  })
  key: string;

  @Column({
    type: 'text',
    name: 'config_value',
    nullable: true,
    comment: '配置值（文本存储，按 type 解析）',
  })
  value: string | null;

  @Column({
    type: 'enum',
    enum: SystemConfigType,
    default: SystemConfigType.STRING,
    comment: '值类型: string/number/boolean/json',
  })
  type: SystemConfigType;

  @Index()
  @Column({
    type: 'varchar',
    name: 'config_group',
    length: 64,
    default: 'default',
    comment: '配置分组',
  })
  group: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '配置描述',
  })
  description: string | null;
}
