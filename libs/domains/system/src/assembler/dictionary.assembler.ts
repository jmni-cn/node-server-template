import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dictionary } from '../entities/dictionary.entity';
import { DictionaryItem } from '../entities/dictionary-item.entity';
import { DictionaryMapper } from '../mapper/dictionary.mapper';
import { DictionaryItemMapper } from '../mapper/dictionary-item.mapper';
import { DictionaryDetailVo } from '../vo/dictionary.vo';

/**
 * 字典装配器。
 *
 * 负责把 Dictionary 实体装配为含字典项的详情 VO。
 * 仅注入 DictionaryItem 仓储（避免与 DictionaryService 形成依赖环）。
 */
@Injectable()
export class DictionaryAssembler {
  constructor(
    @InjectRepository(DictionaryItem)
    private readonly itemRepo: Repository<DictionaryItem>,
  ) {}

  /** 装配字典详情 VO（按 dictId 加载字典项，按 sort 升序）。 */
  async toDetailVo(dict: Dictionary): Promise<DictionaryDetailVo> {
    const items = await this.itemRepo.find({
      where: { dictId: dict.uid },
      order: { sort: 'ASC' },
    });

    return {
      ...DictionaryMapper.toVo(dict),
      items: DictionaryItemMapper.toVoArray(items),
    };
  }
}
