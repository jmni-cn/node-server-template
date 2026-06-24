import { EndUser } from '../entities/end-user.entity';
import { EndUserVo } from '../vo/end-user.vo';

/** EndUser 实体 → VO 映射（纯静态，无 DI，无副作用）。 */
export class EndUserMapper {
  static toVo(entity: EndUser): EndUserVo {
    const vo = new EndUserVo();
    vo.uid = entity.uid;
    vo.username = entity.username;
    vo.email = entity.email;
    vo.phone = entity.phone;
    vo.nickname = entity.nickname;
    vo.status = entity.status;
    vo.lastLoginAt = entity.lastLoginAt;
    vo.createdAt = entity.createdAt;
    return vo;
  }

  static toVoArray(entities: EndUser[]): EndUserVo[] {
    return entities.map((e) => EndUserMapper.toVo(e));
  }
}
