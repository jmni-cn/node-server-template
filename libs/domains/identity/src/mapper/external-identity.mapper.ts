import { ExternalIdentity } from '../entities/external-identity.entity';
import { ExternalIdentityVo } from '../vo/external-identity.vo';

/** ExternalIdentity 实体 → VO 映射（纯静态，无 DI）。 */
export class ExternalIdentityMapper {
  static toVo(entity: ExternalIdentity): ExternalIdentityVo {
    const vo = new ExternalIdentityVo();
    vo.uid = entity.uid;
    vo.subjectType = entity.subjectType;
    vo.provider = entity.provider;
    vo.providerUserId = entity.providerUserId;
    vo.unionId = entity.unionId;
    vo.providerNickname = entity.providerNickname;
    return vo;
  }

  static toVoArray(entities: ExternalIdentity[]): ExternalIdentityVo[] {
    return entities.map((e) => ExternalIdentityMapper.toVo(e));
  }
}
