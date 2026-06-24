import { SecurityEvent } from '../entities/security-event.entity';
import { SecurityEventVo } from '../vo/security-event.vo';

/** SecurityEvent 实体 → VO 映射（纯静态，无 DI，无副作用）。 */
export class SecurityEventMapper {
  static toVo(entity: SecurityEvent): SecurityEventVo {
    const vo = new SecurityEventVo();
    vo.uid = entity.uid;
    vo.subjectType = entity.subjectType;
    vo.eventType = entity.eventType;
    vo.riskLevel = entity.riskLevel;
    vo.sessionUid = entity.sessionUid;
    vo.ipMasked = entity.ipMasked;
    vo.metadata = entity.metadata;
    vo.createdAt = entity.createdAt;
    return vo;
  }

  static toVoArray(entities: SecurityEvent[]): SecurityEventVo[] {
    return entities.map((e) => SecurityEventMapper.toVo(e));
  }
}
