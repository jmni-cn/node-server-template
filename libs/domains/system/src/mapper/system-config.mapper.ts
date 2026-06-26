import { SystemConfig } from '@platform/config';
import { SystemConfigVo } from '../vo/system-config.vo';

/** 系统配置 实体 → VO 映射器（纯静态，无 DI，无副作用）。 */
export class SystemConfigMapper {
  static toVo(entity: SystemConfig): SystemConfigVo {
    return {
      uid: entity.uid,
      key: entity.key,
      // 机密项脱敏：后台列表/详情不回显敏感值。
      value: entity.isSecret ? null : entity.value,
      type: entity.type,
      group: entity.group,
      description: entity.description,
      label: entity.label,
      enabled: entity.enabled,
      isSecret: entity.isSecret,
      isPublic: entity.isPublic,
      isEditable: entity.isEditable,
    };
  }

  static toVoArray(entities: SystemConfig[]): SystemConfigVo[] {
    return entities.map((e) => SystemConfigMapper.toVo(e));
  }
}
