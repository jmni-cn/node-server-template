import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BusinessException,
  PageResultVo,
  createPageResult,
} from '@core/common';
import {
  RuntimeConfigService,
  SystemConfig,
  SystemConfigType,
  getAllConfigDefinitions,
} from '@platform/config';
import { SetConfigDto, QueryConfigDto } from '../dto';
import { SystemConfigVo } from '../vo/system-config.vo';
import { ConfigDefinitionVo } from '../vo/config-definition.vo';
import { SystemConfigMapper } from '../mapper/system-config.mapper';
import { SystemErrorCode } from '../constants/system-error-codes';
import { TypedConfigValue } from '../types';

/**
 * 系统配置服务（后台管理壳）。
 *
 * 职责收敛为「后台只读查询 + 写入委托」：
 * - 列表 / 分页 / 关键字查询：用本服务自己的 SystemConfig repo 直接读 DB（管理视角，
 *   不走运行期热读缓存，保证后台看到的是库内真实状态）；
 * - 单键读取（get）：委托 {@link RuntimeConfigService}，复用其 DB → 代码默认 解析与
 *   Redis 缓存；
 * - 写入 / 删除（set / delete）：委托 {@link RuntimeConfigService}，集中失效缓存，保证
 *   与运行期热更新一致；机密项（isSecret）拒改、只读项（isEditable=false）拒改。
 *
 * 运行期配置定义（默认值 / env 兜底 / 标志位）由各消费 lib 通过
 * registerConfigDefinitions 注册，本服务不再承载解析细节。
 */
@Injectable()
export class SystemConfigService {
  constructor(
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
    private readonly runtimeConfig: RuntimeConfigService,
  ) {}

  /**
   * 设置（upsert）配置：委托 RuntimeConfigService 落库 + 集中失效缓存。
   *
   * 保护规则：
   * - 已存在且 isEditable=false → 拒改（SYS_CFG_NOT_EDITABLE）；
   * - 已存在且 isSecret=true，或目标 type=机密语义 → 拒改（机密值应走 env，
   *   RuntimeConfigService.set 亦会对机密键抛错，此处提前给出业务错误码）；
   * - 写入前按目标 type 校验 value 可被正确解析（NUMBER 合法数字 / JSON 可解析），
   *   不合法抛 SYS_CFG_TYPE_MISMATCH。
   */
  async set(dto: SetConfigDto): Promise<SystemConfigVo> {
    const existing = await this.configRepo.findOne({ where: { key: dto.key } });

    if (existing && !existing.isEditable) {
      throw new BusinessException(SystemErrorCode.SYS_CFG_NOT_EDITABLE, {
        key: dto.key,
      });
    }
    if (existing?.isSecret) {
      throw new BusinessException(SystemErrorCode.SYS_CFG_NOT_EDITABLE, {
        key: dto.key,
        reason: 'secret',
      });
    }

    // 目标类型：更新时若 dto 未显式给出 type 则沿用既有 type，新建时默认 STRING。
    const targetType = dto.type ?? existing?.type ?? SystemConfigType.STRING;
    const parsed = this.parseRaw(dto.key, targetType, dto.value ?? null);

    // 委托运行期服务写库 + 失效两级缓存（与热更新一致）。
    // 传入已按 type 解析后的值，RuntimeConfigService 内部按 type 序列化。
    await this.runtimeConfig.set(dto.key, parsed, {
      type: targetType,
      group: dto.group ?? existing?.group ?? 'default',
      description: dto.description ?? existing?.description ?? undefined,
      enabled: dto.enabled,
      label: dto.label,
      sort: dto.sort,
    });

    return this.getVo(dto.key);
  }

  /** 按 key 获取原始配置实体（不存在抛 SYS_CFG_NOT_FOUND）。 */
  async getRaw(key: string): Promise<SystemConfig> {
    const config = await this.configRepo.findOne({ where: { key } });
    if (!config) {
      throw new BusinessException(SystemErrorCode.SYS_CFG_NOT_FOUND, { key });
    }
    return config;
  }

  /** 按 key 获取配置 VO（后台详情；机密项已脱敏）。 */
  async getVo(key: string): Promise<SystemConfigVo> {
    return SystemConfigMapper.toVo(await this.getRaw(key));
  }

  /**
   * 按 key 获取类型化配置值：委托 RuntimeConfigService（DB → 代码默认，fail-safe）。
   *
   * 注：运行期解析对未知键不抛错而回退默认，这与旧实现「不存在抛 SYS_CFG_NOT_FOUND」
   * 不同——后台「确认某键存在」请改用 {@link getRaw} / {@link getVo}。
   */
  async get<T = TypedConfigValue>(key: string): Promise<T> {
    const config = await this.getRaw(key);
    switch (config.type) {
      case SystemConfigType.BOOLEAN:
        return (await this.runtimeConfig.getBoolean(key)) as T;
      case SystemConfigType.NUMBER:
        return (await this.runtimeConfig.getNumber(key)) as T;
      case SystemConfigType.JSON:
        return this.runtimeConfig.getJson<T>(key);
      case SystemConfigType.STRING:
      default:
        return (await this.runtimeConfig.getString(key)) as T;
    }
  }

  /** 按分组获取配置列表（VO，管理视角直读 DB）。 */
  async getByGroup(group: string): Promise<SystemConfigVo[]> {
    const configs = await this.configRepo.find({
      where: { group },
      order: { key: 'ASC' },
    });
    return SystemConfigMapper.toVoArray(configs);
  }

  /**
   * 获取配置定义目录（后台「键/默认/来源/业务含义」展示）。
   *
   * 聚合各消费 lib 注册的运行期配置定义（getAllConfigDefinitions），并叠加
   * RuntimeConfigService.resolveWithSource 的当前解析结果（值 + 来源），让后台
   * 一眼看清某键当前生效值来自 DB 覆盖 / 代码默认。机密项当前值脱敏。
   */
  async getDefinitions(): Promise<ConfigDefinitionVo[]> {
    const defs = getAllConfigDefinitions();
    return Promise.all(
      defs.map(async (def) => {
        const resolved = await this.runtimeConfig.resolveWithSource(def.key);
        return {
          key: def.key,
          group: def.group,
          label: def.label,
          description: def.description,
          valueType: def.valueType,
          defaultValue: def.defaultValue,
          isSecret: def.isSecret ?? false,
          isPublic: def.isPublic ?? false,
          isEditable: def.isEditable ?? true,
          // 机密项当前值脱敏，避免后台泄露敏感值。
          currentValue: def.isSecret ? null : resolved.value,
          source: resolved.source,
        };
      }),
    );
  }

  /** 分页查询配置（分组过滤 + key 模糊搜索；管理视角直读 DB）。 */
  async list(dto: QueryConfigDto): Promise<PageResultVo<SystemConfigVo>> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 10;

    const qb = this.configRepo.createQueryBuilder('config');

    if (dto.group) {
      qb.andWhere('config.group = :group', { group: dto.group });
    }
    if (dto.keyword) {
      qb.andWhere('config.key LIKE :keyword', {
        keyword: `%${dto.keyword}%`,
      });
    }

    qb.orderBy('config.key', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [entities, total] = await qb.getManyAndCount();
    return createPageResult(
      SystemConfigMapper.toVoArray(entities),
      total,
      page,
      pageSize,
    );
  }

  /**
   * 删除配置（委托 RuntimeConfigService 软删 + 集中失效缓存）。
   * 只读 / 机密项拒删（SYS_CFG_NOT_EDITABLE）。
   */
  async delete(key: string): Promise<void> {
    const config = await this.getRaw(key);
    if (!config.isEditable || config.isSecret) {
      throw new BusinessException(SystemErrorCode.SYS_CFG_NOT_EDITABLE, { key });
    }
    await this.runtimeConfig.delete(key);
  }

  /** 按 type 将原始字符串解析为类型化值（解析失败抛 SYS_CFG_TYPE_MISMATCH）。 */
  private parseRaw(
    key: string,
    type: SystemConfigType,
    raw: string | null,
  ): TypedConfigValue {
    switch (type) {
      case SystemConfigType.STRING:
        return raw;
      case SystemConfigType.BOOLEAN:
        return raw === 'true';
      case SystemConfigType.NUMBER: {
        if (raw === null || raw.trim() === '') {
          throw new BusinessException(SystemErrorCode.SYS_CFG_TYPE_MISMATCH, {
            key,
            type,
          });
        }
        const num = Number(raw);
        if (Number.isNaN(num)) {
          throw new BusinessException(SystemErrorCode.SYS_CFG_TYPE_MISMATCH, {
            key,
            type,
          });
        }
        return num;
      }
      case SystemConfigType.JSON: {
        if (raw === null) return null;
        try {
          return JSON.parse(raw) as Record<string, unknown> | unknown[];
        } catch {
          throw new BusinessException(SystemErrorCode.SYS_CFG_TYPE_MISMATCH, {
            key,
            type,
          });
        }
      }
      default:
        return raw;
    }
  }
}
