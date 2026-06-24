import { AdminUser } from '../entities/admin-user.entity';
import { AdminUserVo } from '../vo/admin-user.vo';

/** AdminUser 实体 → VO 映射（纯静态，无 DI，无副作用）。 */
export class AdminUserMapper {
  static toVo(entity: AdminUser): AdminUserVo {
    const vo = new AdminUserVo();
    vo.uid = entity.uid;
    vo.username = entity.username;
    vo.email = entity.email;
    vo.nickname = entity.nickname;
    vo.status = entity.status;
    vo.lastLoginAt = entity.lastLoginAt;
    vo.createdAt = entity.createdAt;
    return vo;
  }

  static toVoArray(entities: AdminUser[]): AdminUserVo[] {
    return entities.map((e) => AdminUserMapper.toVo(e));
  }
}
