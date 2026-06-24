import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '@core/common';
import { CacheService } from '@platform/cache';
import { Dictionary } from '../entities/dictionary.entity';
import {
  DictionaryItem,
  DictionaryItemStatus,
} from '../entities/dictionary-item.entity';
import {
  CreateDictionaryDto,
  UpdateDictionaryDto,
  CreateDictionaryItemDto,
  UpdateDictionaryItemDto,
} from '../dto';
import { DictionaryVo, DictionaryDetailVo } from '../vo/dictionary.vo';
import { DictionaryItemVo } from '../vo/dictionary-item.vo';
import { DictionaryMapper } from '../mapper/dictionary.mapper';
import { DictionaryItemMapper } from '../mapper/dictionary-item.mapper';
import { DictionaryAssembler } from '../assembler/dictionary.assembler';
import { SystemErrorCode } from '../constants/system-error-codes';
import { SYSTEM_CACHE } from '../constants/cache.constants';

/**
 * 字典服务。
 *
 * 管理字典与字典项，按 code 缓存读取启用字典项。
 */
@Injectable()
export class DictionaryService {
  constructor(
    @InjectRepository(Dictionary)
    private readonly dictRepo: Repository<Dictionary>,
    @InjectRepository(DictionaryItem)
    private readonly itemRepo: Repository<DictionaryItem>,
    private readonly cache: CacheService,
    private readonly assembler: DictionaryAssembler,
  ) {}

  /** 创建字典（code 唯一）。 */
  async createDict(dto: CreateDictionaryDto): Promise<DictionaryVo> {
    const exists = await this.dictRepo.findOne({ where: { code: dto.code } });
    if (exists) {
      throw new BusinessException(SystemErrorCode.SYS_DICT_CODE_TAKEN, {
        code: dto.code,
      });
    }

    const entity = this.dictRepo.create({
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
    });
    const saved = await this.dictRepo.save(entity);
    return DictionaryMapper.toVo(saved);
  }

  /** 更新字典。 */
  async updateDict(
    uid: string,
    dto: UpdateDictionaryDto,
  ): Promise<DictionaryVo> {
    const dict = await this.findDictByUid(uid);

    if (dto.name !== undefined) dict.name = dto.name;
    if (dto.description !== undefined)
      dict.description = dto.description ?? null;

    const saved = await this.dictRepo.save(dict);
    await this.invalidateCode(saved.code);
    return DictionaryMapper.toVo(saved);
  }

  /** 按 uid 查询字典实体（不存在抛 SYS_DICT_NOT_FOUND）。 */
  async findDictByUid(uid: string): Promise<Dictionary> {
    const dict = await this.dictRepo.findOne({ where: { uid } });
    if (!dict) {
      throw new BusinessException(SystemErrorCode.SYS_DICT_NOT_FOUND, { uid });
    }
    return dict;
  }

  /** 获取字典详情（含字典项）。 */
  async getDictDetail(uid: string): Promise<DictionaryDetailVo> {
    const dict = await this.findDictByUid(uid);
    return this.assembler.toDetailVo(dict);
  }

  /** 新增字典项（校验所属字典存在，并失效该字典 code 缓存）。 */
  async addItem(dto: CreateDictionaryItemDto): Promise<DictionaryItemVo> {
    const dict = await this.findDictByUid(dto.dictId);

    const entity = this.itemRepo.create({
      dictId: dto.dictId,
      label: dto.label,
      value: dto.value,
      sort: dto.sort ?? 0,
      status: dto.status ?? DictionaryItemStatus.ENABLED,
    });
    const saved = await this.itemRepo.save(entity);
    await this.invalidateCode(dict.code);
    return DictionaryItemMapper.toVo(saved);
  }

  /** 更新字典项（不存在抛 SYS_DICT_ITEM_NOT_FOUND，并失效相关 code 缓存）。 */
  async updateItem(
    uid: string,
    dto: UpdateDictionaryItemDto,
  ): Promise<DictionaryItemVo> {
    const item = await this.itemRepo.findOne({ where: { uid } });
    if (!item) {
      throw new BusinessException(SystemErrorCode.SYS_DICT_ITEM_NOT_FOUND, {
        uid,
      });
    }

    if (dto.label !== undefined) item.label = dto.label;
    if (dto.value !== undefined) item.value = dto.value;
    if (dto.sort !== undefined) item.sort = dto.sort;
    if (dto.status !== undefined) item.status = dto.status;

    const saved = await this.itemRepo.save(item);

    const dict = await this.dictRepo.findOne({ where: { uid: saved.dictId } });
    if (dict) await this.invalidateCode(dict.code);

    return DictionaryItemMapper.toVo(saved);
  }

  /**
   * 按字典 code 获取启用字典项（缓存读取）。
   * 缓存 key=code，命名空间 system，TTL SYSTEM_CACHE.DICT_TTL。
   * code 不存在抛 SYS_DICT_NOT_FOUND。
   */
  async getItemsByCode(code: string): Promise<DictionaryItemVo[]> {
    return this.cache.getOrSet<DictionaryItemVo[]>(
      code,
      async () => {
        const dict = await this.dictRepo.findOne({ where: { code } });
        if (!dict) {
          throw new BusinessException(SystemErrorCode.SYS_DICT_NOT_FOUND, {
            code,
          });
        }

        const items = await this.itemRepo.find({
          where: { dictId: dict.uid, status: DictionaryItemStatus.ENABLED },
          order: { sort: 'ASC' },
        });
        return DictionaryItemMapper.toVoArray(items);
      },
      SYSTEM_CACHE.DICT_TTL,
      SYSTEM_CACHE.NAMESPACE,
    );
  }

  /** 失效指定字典 code 的缓存。 */
  private async invalidateCode(code: string): Promise<void> {
    await this.cache.del(code, SYSTEM_CACHE.NAMESPACE);
  }
}
