import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BusinessException,
  PageResultVo,
  createPageResult,
} from '@core/common';
import { CacheService } from '@platform/cache';
import {
  SystemConfig,
  SystemConfigType,
} from '../entities/system-config.entity';
import { SetConfigDto, QueryConfigDto } from '../dto';
import { SystemConfigVo } from '../vo/system-config.vo';
import { SystemConfigMapper } from '../mapper/system-config.mapper';
import { SystemErrorCode } from '../constants/system-error-codes';
import { SYSTEM_CACHE } from '../constants/cache.constants';
import { TypedConfigValue } from '../types';

/**
 * 系统配置服务。
 *
 * 基于 key 的键值配置，读取走缓存并按 type 做类型化解析。
 */
@Injectable()
export class SystemConfigService {
  constructor(
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
    private readonly cache: CacheService,
  ) {}

  /** 设置（upsert）配置；失效该 key 与其分组缓存。 */
  async set(dto: SetConfigDto): Promise<SystemConfigVo> {
    let entity = await this.configRepo.findOne({ where: { key: dto.key } });

    if (!entity) {
      entity = this.configRepo.create({
        key: dto.key,
        value: dto.value ?? null,
        type: dto.type ?? SystemConfigType.STRING,
        group: dto.group ?? 'default',
        description: dto.description ?? null,
      });
    } else {
      entity.value = dto.value ?? null;
      if (dto.type !== undefined) entity.type = dto.type;
      if (dto.group !== undefined) entity.group = dto.group;
      if (dto.description !== undefined) {
        entity.description = dto.description ?? null;
      }
    }

    const saved = await this.configRepo.save(entity);
    await this.invalidate(saved.key, saved.group);
    return SystemConfigMapper.toVo(saved);
  }

  /** 按 key 获取原始配置实体（不存在抛 SYS_CFG_NOT_FOUND）。 */
  async getRaw(key: string): Promise<SystemConfig> {
    const config = await this.configRepo.findOne({ where: { key } });
    if (!config) {
      throw new BusinessException(SystemErrorCode.SYS_CFG_NOT_FOUND, { key });
    }
    return config;
  }

  /**
   * 按 key 获取类型化配置值（缓存读取）。
   * 按 type 解析：STRING→string，NUMBER→Number，BOOLEAN→value==='true'，JSON→JSON.parse。
   * NUMBER/JSON 解析失败抛 SYS_CFG_TYPE_MISMATCH。
   */
  async get<T = TypedConfigValue>(key: string): Promise<T> {
    return this.cache.getOrSet<T>(
      this.valueKey(key),
      async () => {
        const config = await this.getRaw(key);
        return this.parseValue(config) as T;
      },
      SYSTEM_CACHE.CONFIG_TTL,
      SYSTEM_CACHE.NAMESPACE,
    );
  }

  /** 按分组获取配置列表（VO）。 */
  async getByGroup(group: string): Promise<SystemConfigVo[]> {
    return this.cache.getOrSet<SystemConfigVo[]>(
      this.groupKey(group),
      async () => {
        const configs = await this.configRepo.find({
          where: { group },
          order: { key: 'ASC' },
        });
        return SystemConfigMapper.toVoArray(configs);
      },
      SYSTEM_CACHE.CONFIG_TTL,
      SYSTEM_CACHE.NAMESPACE,
    );
  }

  /** 分页查询配置（分组过滤 + key 模糊搜索）。 */
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

  /** 删除配置（失效该 key 与其分组缓存）。 */
  async delete(key: string): Promise<void> {
    const config = await this.getRaw(key);
    await this.configRepo.remove(config);
    await this.invalidate(config.key, config.group);
  }

  /** 按 type 解析配置值。 */
  private parseValue(config: SystemConfig): TypedConfigValue {
    const raw = config.value;

    switch (config.type) {
      case SystemConfigType.STRING:
        return raw;
      case SystemConfigType.BOOLEAN:
        return raw === 'true';
      case SystemConfigType.NUMBER: {
        if (raw === null || raw.trim() === '') {
          throw new BusinessException(SystemErrorCode.SYS_CFG_TYPE_MISMATCH, {
            key: config.key,
            type: config.type,
          });
        }
        const num = Number(raw);
        if (Number.isNaN(num)) {
          throw new BusinessException(SystemErrorCode.SYS_CFG_TYPE_MISMATCH, {
            key: config.key,
            type: config.type,
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
            key: config.key,
            type: config.type,
          });
        }
      }
      default:
        return raw;
    }
  }

  /** 失效指定 key 与分组的缓存。 */
  private async invalidate(key: string, group: string): Promise<void> {
    await this.cache.del(this.valueKey(key), SYSTEM_CACHE.NAMESPACE);
    await this.cache.del(this.groupKey(group), SYSTEM_CACHE.NAMESPACE);
  }

  /** 配置值缓存 key。 */
  private valueKey(key: string): string {
    return `config:${key}`;
  }

  /** 分组缓存 key。 */
  private groupKey(group: string): string {
    return `config-group:${group}`;
  }
}
