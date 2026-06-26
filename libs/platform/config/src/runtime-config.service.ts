import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheService } from '@platform/cache';
import {
  SystemConfig,
  SystemConfigSource,
  SystemConfigType,
} from './entities/system-config.entity';
import {
  ConfigDefinition,
  getConfigDefinition,
} from './definitions/config-definition.type';

/** Redis 缓存命名空间（与其它域缓存隔离）。 */
const CACHE_NAMESPACE = 'runtime-config';

/** Redis 缓存 TTL（秒）。 */
const REDIS_TTL_SECONDS = 300;

/** 解析来源标识。 */
export type ConfigSource =
  | 'db'
  | 'code_default'
  | 'disabled_fallback'
  | 'error_fallback';

/** resolveWithSource 的返回结构。 */
export interface ResolvedConfig<T> {
  /** 最终解析出的值。 */
  value: T;
  /** 值的来源。 */
  source: ConfigSource;
  /** 命中 def.valueBehaviors 时的语义化行为。 */
  behavior?: string;
}

/** 配置在 DB/缓存中的解析快照（仅存解析必需字段）。 */
interface ConfigSnapshot {
  /** DB 中存储的原始文本值（可能为 null）。 */
  value: string | null;
  /** 是否启用（禁用则解析时回退代码默认）。 */
  enabled: boolean;
  /** 值类型。 */
  type: SystemConfigType;
  /** 是否为「负缓存」（DB 无此键）。 */
  negative: boolean;
}

/** set 的可选元信息（写库时落库）。 */
export interface SetConfigMeta {
  type?: SystemConfigType;
  group?: string;
  label?: string;
  description?: string;
  enabled?: boolean;
  isSecret?: boolean;
  isPublic?: boolean;
  isEditable?: boolean;
  source?: SystemConfigSource;
  sort?: number;
}

/**
 * RuntimeConfigService — 运行时配置读取/写入服务（业务/安全配置热更新核心）。
 *
 * 解析优先级：DB 行（启用且有值）→ 代码默认值（def.defaultValue ?? 传入默认）。
 *
 * 特性：
 * - fail-safe typed getters：任何异常一律回退默认值，**绝不抛出**；
 * - resolveWithSource：返回值并标注来源（db/code_default/disabled_fallback/error_fallback）；
 * - 缓存：仅 Redis（含负缓存防穿透），**无进程内缓存**——保证多实例下写时失效即时一致；
 * - 写时失效：set/delete 写库后清 Redis 缓存，所有实例下次读立即回源；
 * - 机密保护：def.isSecret 的键不参与 DB 写入校验场景（机密值应走 env，不入 DB）。
 *
 * 注意：本服务**只依赖 @platform/cache 与 SystemConfig 实体**，不得依赖 @domains/@integrations，
 * 以避免循环依赖（它是被下游 lib 消费的低层基础设施）。
 */
@Injectable()
export class RuntimeConfigService {
  private readonly logger = new Logger(RuntimeConfigService.name);

  constructor(
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
    private readonly cache: CacheService,
  ) {}

  // ==================== fail-safe typed getters ====================

  /** 读取布尔值（fail-safe，绝不抛）。 */
  async getBoolean(key: string, defaultValue?: boolean): Promise<boolean> {
    const resolved = await this.resolveWithSource<boolean>(key, defaultValue);
    return resolved.value;
  }

  /** 读取数值（fail-safe，绝不抛）。 */
  async getNumber(key: string, defaultValue?: number): Promise<number> {
    const resolved = await this.resolveWithSource<number>(key, defaultValue);
    return resolved.value;
  }

  /** 读取字符串（fail-safe，绝不抛）。 */
  async getString(key: string, defaultValue?: string): Promise<string> {
    const resolved = await this.resolveWithSource<string>(key, defaultValue);
    return resolved.value;
  }

  /** 读取 JSON 对象（fail-safe，绝不抛）。 */
  async getJson<T>(key: string, defaultValue?: T): Promise<T> {
    const resolved = await this.resolveWithSource<T>(key, defaultValue);
    return resolved.value;
  }

  // ==================== 来源追踪解析 ====================

  /**
   * 解析配置并返回值 + 来源。fail-safe：任何异常回退到默认值并标注 error_fallback。
   *
   * 解析顺序（两层：DB 覆盖 → 代码默认）：
   * 1. DB 行（enabled=true 且有值）→ source='db'
   * 2. DB 行存在但 enabled=false → 回落代码默认，source='disabled_fallback'
   * 3. def.defaultValue ?? 传入 defaultValue → source='code_default'
   */
  async resolveWithSource<T>(
    key: string,
    defaultValue?: T,
  ): Promise<ResolvedConfig<T>> {
    const def = getConfigDefinition(key);
    try {
      const dbEntry = await this.loadFromDb(key);

      // 1) DB 命中且启用且有值。
      if (dbEntry && !dbEntry.negative && dbEntry.enabled) {
        if (dbEntry.value !== null) {
          const type = dbEntry.type ?? def?.valueType ?? SystemConfigType.STRING;
          const parsed = this.parseRaw<T>(dbEntry.value, type);
          if (parsed !== undefined) {
            return {
              value: parsed,
              source: 'db',
              behavior: this.resolveBehavior(def, parsed),
            };
          }
        }
      }

      // 2) DB 存在但被禁用：标记，使最终回退来源更精确。
      const disabled = !!dbEntry && !dbEntry.negative && !dbEntry.enabled;

      // 3) 代码默认值。
      const codeDefault = (def?.defaultValue ?? defaultValue) as T;
      return {
        value: codeDefault,
        source: disabled ? 'disabled_fallback' : 'code_default',
        behavior: this.resolveBehavior(def, codeDefault),
      };
    } catch (err) {
      this.logger.warn(
        `resolveWithSource(${key}) 失败，回退默认值: ${(err as Error).message}`,
      );
      const fallback = (def?.defaultValue ?? defaultValue) as T;
      return { value: fallback, source: 'error_fallback' };
    }
  }

  // ==================== 写 API（集中失效） ====================

  /**
   * 写入/更新配置（落库 + 失效两级缓存）。
   *
   * 机密保护：若该 key 在定义中标记 isSecret，则拒绝写库（机密值应走 env）。
   */
  async set<T>(key: string, value: T, meta?: SetConfigMeta): Promise<void> {
    const def = getConfigDefinition(key);
    if (def?.isSecret || meta?.isSecret) {
      throw new Error(`拒绝将机密配置写入数据库: ${key}`);
    }

    const type =
      meta?.type ?? def?.valueType ?? this.inferType(value);
    const raw = this.serialize(value, type);

    let entity = await this.configRepo.findOne({ where: { key } });
    if (!entity) {
      entity = this.configRepo.create({
        key,
        group: meta?.group ?? def?.group ?? 'default',
        type,
        source: meta?.source ?? SystemConfigSource.API,
      });
    }

    entity.value = raw;
    entity.type = type;
    if (meta?.group !== undefined) entity.group = meta.group;
    if (meta?.label !== undefined) entity.label = meta.label;
    if (meta?.description !== undefined) entity.description = meta.description;
    if (meta?.enabled !== undefined) entity.enabled = meta.enabled;
    if (meta?.isPublic !== undefined) entity.isPublic = meta.isPublic;
    if (meta?.isEditable !== undefined) entity.isEditable = meta.isEditable;
    if (meta?.source !== undefined) entity.source = meta.source;
    if (meta?.sort !== undefined) entity.sort = meta.sort;

    await this.configRepo.save(entity);
    await this.invalidate(key);
  }

  /** 软删除配置（落库软删 + 失效两级缓存）。 */
  async delete(key: string): Promise<void> {
    await this.configRepo.softDelete({ key });
    await this.invalidate(key);
  }

  /** 失效某 key 的 Redis 缓存（写时失效统一入口；多实例下次读即回源）。 */
  async invalidate(key: string): Promise<void> {
    await this.cache.del(key, CACHE_NAMESPACE).catch(() => undefined);
  }

  // ==================== 内部：DB 读取 + Redis 缓存 ====================

  /**
   * 从「Redis → DB」读取配置快照（含负缓存防穿透）。命中 DB 后回写 Redis。
   * 不使用进程内缓存：保证多实例在写时失效后下次读立即一致。
   */
  private async loadFromDb(key: string): Promise<ConfigSnapshot | null> {
    // 一级：Redis 缓存。
    const cached = await this.cache
      .get<ConfigSnapshot>(key, CACHE_NAMESPACE)
      .catch(() => null);
    if (cached) {
      return cached;
    }

    // 回源 DB。
    const row = await this.configRepo.findOne({ where: { key } });
    const entry: ConfigSnapshot = row
      ? {
          value: row.value,
          enabled: row.enabled,
          type: row.type,
          negative: false,
        }
      : {
          value: null,
          enabled: false,
          type: SystemConfigType.STRING,
          negative: true,
        };

    // 回写 Redis（负缓存也写，防穿透）。
    await this.cache
      .set(key, entry, REDIS_TTL_SECONDS, CACHE_NAMESPACE)
      .catch(() => undefined);

    return entry;
  }

  // ==================== 内部：序列化/解析 ====================

  /** 把原始文本按类型解析为目标值；解析失败返回 undefined（由调用方继续兜底）。 */
  private parseRaw<T>(raw: string, type: SystemConfigType): T | undefined {
    try {
      switch (type) {
        case SystemConfigType.BOOLEAN:
          return (raw === 'true' || raw === '1') as unknown as T;
        case SystemConfigType.NUMBER: {
          const n = Number(raw);
          return Number.isNaN(n) ? undefined : (n as unknown as T);
        }
        case SystemConfigType.JSON:
          return JSON.parse(raw) as T;
        case SystemConfigType.STRING:
        default:
          return raw as unknown as T;
      }
    } catch {
      return undefined;
    }
  }

  /** 把值序列化为可落库的文本。 */
  private serialize(value: unknown, type: SystemConfigType): string {
    if (type === SystemConfigType.JSON) {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /** 由 JS 运行时值推断配置类型（仅在缺少定义/元信息时使用）。 */
  private inferType(value: unknown): SystemConfigType {
    switch (typeof value) {
      case 'boolean':
        return SystemConfigType.BOOLEAN;
      case 'number':
        return SystemConfigType.NUMBER;
      case 'object':
        return SystemConfigType.JSON;
      default:
        return SystemConfigType.STRING;
    }
  }

  /** 命中 def.valueBehaviors 时返回对应语义化行为。 */
  private resolveBehavior(
    def: ConfigDefinition | undefined,
    value: unknown,
  ): string | undefined {
    if (!def?.valueBehaviors) return undefined;
    return def.valueBehaviors[String(value)];
  }
}
