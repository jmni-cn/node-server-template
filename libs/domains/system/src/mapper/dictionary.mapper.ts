import { Dictionary } from '../entities/dictionary.entity';
import { DictionaryVo } from '../vo/dictionary.vo';

/** 字典 实体 → VO 映射器（纯静态，无 DI）。 */
export class DictionaryMapper {
  static toVo(entity: Dictionary): DictionaryVo {
    return {
      uid: entity.uid,
      code: entity.code,
      name: entity.name,
      description: entity.description,
    };
  }

  static toVoArray(entities: Dictionary[]): DictionaryVo[] {
    return entities.map((e) => DictionaryMapper.toVo(e));
  }
}
