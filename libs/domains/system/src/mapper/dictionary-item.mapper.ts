import { DictionaryItem } from '../entities/dictionary-item.entity';
import { DictionaryItemVo } from '../vo/dictionary-item.vo';

/** 字典项 实体 → VO 映射器（纯静态，无 DI）。 */
export class DictionaryItemMapper {
  static toVo(entity: DictionaryItem): DictionaryItemVo {
    return {
      uid: entity.uid,
      label: entity.label,
      value: entity.value,
      sort: entity.sort,
      status: entity.status,
    };
  }

  static toVoArray(entities: DictionaryItem[]): DictionaryItemVo[] {
    return entities.map((e) => DictionaryItemMapper.toVo(e));
  }
}
