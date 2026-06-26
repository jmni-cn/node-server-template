/**
 * SystemConfig Entity — 系统配置实体。
 *
 * 基于 key 的键值配置，value 以文本存储，按 type 在读取时做类型化解析。
 *
 * 归属：本实体下沉到 @platform/config（运行时配置基础设施层），
 * 由 RuntimeConfigService 与后台「系统配置」管理壳共同使用。
 * 表名仍为 `system_configs`，static uidPrefix='cfg' 保持不变。
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

/**
 * 配置来源（用于区分配置写入渠道，便于审计/保护 seed 默认值）。
 * - seed：模板/系统初始化写入；
 * - manual：人工通过后台或脚本写入（默认）；
 * - api：通过运行期写 API（RuntimeConfigService.set）写入。
 */
export enum SystemConfigSource {
  SEED = 'seed',
  MANUAL = 'manual',
  API = 'api',
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

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '展示标签（后台列表/表单友好名称）',
  })
  label: string | null;

  @Column({
    type: 'boolean',
    default: true,
    comment: '是否启用（禁用后运行期读取回退到 env/默认值）',
  })
  enabled: boolean;

  @Column({
    type: 'boolean',
    name: 'is_secret',
    default: false,
    comment: '是否机密（机密值不应写入本表，仅作标志位防误读/误展示）',
  })
  isSecret: boolean;

  @Column({
    type: 'boolean',
    name: 'is_public',
    default: false,
    comment: '是否可对外公开（如下发给前端）',
  })
  isPublic: boolean;

  @Column({
    type: 'boolean',
    name: 'is_editable',
    default: true,
    comment: '是否允许后台编辑（false 表示只读，仅可通过迁移/seed 变更）',
  })
  isEditable: boolean;

  @Column({
    type: 'enum',
    enum: SystemConfigSource,
    default: SystemConfigSource.MANUAL,
    comment: '配置来源: seed/manual/api',
  })
  source: SystemConfigSource;

  @Column({
    type: 'int',
    default: 0,
    comment: '排序值（越小越靠前）',
  })
  sort: number;
}
