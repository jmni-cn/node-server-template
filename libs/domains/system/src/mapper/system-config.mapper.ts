import { SystemConfig } from '../entities/system-config.entity';
import { SystemConfigVo } from '../vo/system-config.vo';

/** 系统配置 实体 → VO 映射器（纯静态，无 DI）。 */
export class SystemConfigMapper {
  static toVo(entity: SystemConfig): SystemConfigVo {
    return {
      uid: entity.uid,
      key: entity.key,
      value: entity.value,
      type: entity.type,
      group: entity.group,
      description: entity.description,
    };
  }

  static toVoArray(entities: SystemConfig[]): SystemConfigVo[] {
    return entities.map((e) => SystemConfigMapper.toVo(e));
  }
}
