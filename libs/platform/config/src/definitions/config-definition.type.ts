/**
 * ConfigDefinition — 运行时配置「定义注册表」。
 *
 * 定义描述某个配置键的元信息（分组、类型、默认值、标志位等），
 * 由各消费 lib 在模块初始化时通过 `registerConfigDefinitions` 注册进来。
 *
 * 该注册表是 RuntimeConfigService 解析链路的「代码默认值」来源：
 *   DB 行（启用且有值）→ def.defaultValue
 *
 * 设计仿 @core/common 的 `registerErrorCodeHttpStatus`：模块级单例 Map，按 key 去重 upsert。
 */

import { SystemConfigType } from '../entities/system-config.entity';

/** 单个配置键的定义。 */
export interface ConfigDefinition {
  /** 配置键（全局唯一，建议点分命名，如 `security.login.maxFailedAttempts`）。 */
  key: string;
  /** 配置分组（与实体 group 对应）。 */
  group: string;
  /** 展示标签（后台列表/表单友好名称）。 */
  label: string;
  /** 配置描述（可选）。 */
  description?: string;
  /** 值类型（解析与校验依据）。 */
  valueType: SystemConfigType;
  /** 代码默认值（解析链最末端的兜底值）。 */
  defaultValue: unknown;
  /** 是否机密（机密值永不进 DB，仅作标志位）。 */
  isSecret?: boolean;
  /** 是否可对外公开。 */
  isPublic?: boolean;
  /** 是否允许后台编辑。 */
  isEditable?: boolean;
  /** 排序值（越小越靠前）。 */
  sort?: number;
  /**
   * 值行为映射（可选）：把某些「取值」映射为语义化「行为」字符串，
   * 供 resolveWithSource 在结果中回传 behavior 字段，便于调用方做语义分支。
   * @example { '0': 'unlimited', '-1': 'disabled' }
   */
  valueBehaviors?: Record<string, string>;
}

/**
 * 模块级配置定义注册表（key → ConfigDefinition）。
 *
 * 单例 Map，进程内全局共享；通过 registerConfigDefinitions 写入。
 */
const CONFIG_DEFINITIONS = new Map<string, ConfigDefinition>();

/**
 * 注册一批配置定义（按 key 去重 upsert：后注册覆盖先注册的同 key 定义）。
 *
 * @description 供 @platform / @domains / @integrations 等 lib 在模块初始化时调用。
 * @example
 * ```typescript
 * import { registerConfigDefinitions } from '@platform/config';
 * registerConfigDefinitions([
 *   {
 *     key: 'security.login.maxFailedAttempts',
 *     group: 'security',
 *     label: '登录最大失败次数',
 *     valueType: SystemConfigType.NUMBER,
 *     defaultValue: 5,
 *   },
 * ]);
 * ```
 */
export function registerConfigDefinitions(defs: ConfigDefinition[]): void {
  for (const def of defs) {
    CONFIG_DEFINITIONS.set(def.key, def);
  }
}

/** 按 key 获取配置定义（未注册返回 undefined）。 */
export function getConfigDefinition(key: string): ConfigDefinition | undefined {
  return CONFIG_DEFINITIONS.get(key);
}

/** 获取全部已注册的配置定义（快照数组）。 */
export function getAllConfigDefinitions(): ConfigDefinition[] {
  return Array.from(CONFIG_DEFINITIONS.values());
}
