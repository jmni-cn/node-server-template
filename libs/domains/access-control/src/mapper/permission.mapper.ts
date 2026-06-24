import { Permission } from '../entities/permission.entity';
import { PermissionVo } from '../vo/permission.vo';

/**
 * PermissionMapper — Permission 实体到 PermissionVo 的纯静态映射。
 */
export class PermissionMapper {
  static toVo(permission: Permission): PermissionVo {
    return {
      uid: permission.uid,
      code: permission.code,
      name: permission.name,
      group: permission.group,
    };
  }

  static toVoArray(permissions: Permission[]): PermissionVo[] {
    return permissions.map((p) => PermissionMapper.toVo(p));
  }
}
