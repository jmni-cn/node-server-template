import { UserSession } from '../entities/user-session.entity';
import { SessionVo } from '../vo/session.vo';

/** UserSession 实体 → VO 映射（纯静态，无 DI，无副作用）。 */
export class SessionMapper {
  /**
   * @param entity 会话实体
   * @param currentJti 当前请求会话的 jti，用于标记 current 标志（可选）
   */
  static toVo(entity: UserSession, currentJti?: string): SessionVo {
    const vo = new SessionVo();
    vo.uid = entity.uid;
    vo.subjectType = entity.subjectType;
    vo.device = entity.device;
    vo.deviceName = entity.deviceName;
    vo.platform = entity.platform;
    vo.ip = entity.ip;
    vo.userAgent = entity.userAgent;
    vo.lastSeenAt = entity.lastSeenAt;
    vo.expiresAt = entity.expiresAt;
    vo.revokedAt = entity.revokedAt;
    vo.current = currentJti != null && entity.jti === currentJti;
    vo.createdAt = entity.createdAt;
    return vo;
  }

  static toVoArray(entities: UserSession[], currentJti?: string): SessionVo[] {
    return entities.map((e) => SessionMapper.toVo(e, currentJti));
  }
}
