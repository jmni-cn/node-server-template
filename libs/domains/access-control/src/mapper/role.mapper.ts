import { Role } from '../entities/role.entity';
import { RoleVo } from '../vo/role.vo';

/**
 * RoleMapper — Role 实体到 RoleVo 的纯静态映射。
 */
export class RoleMapper {
  static toVo(role: Role): RoleVo {
    return {
      uid: role.uid,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      enabled: role.enabled,
    };
  }

  static toVoArray(roles: Role[]): RoleVo[] {
    return roles.map((r) => RoleMapper.toVo(r));
  }
}
