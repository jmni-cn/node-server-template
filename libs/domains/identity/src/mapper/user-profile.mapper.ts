import { UserProfile } from '../entities/user-profile.entity';
import { UserProfileVo } from '../vo/user-profile.vo';

/** UserProfile 实体 → VO 映射（纯静态，无 DI）。 */
export class UserProfileMapper {
  static toVo(entity: UserProfile): UserProfileVo {
    const vo = new UserProfileVo();
    vo.nickname = entity.nickname;
    vo.avatar = entity.avatar;
    vo.gender = entity.gender;
    vo.bio = entity.bio;
    return vo;
  }
}
