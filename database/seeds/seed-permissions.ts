/**
 * seed-permissions — 基础权限 / 角色 / 菜单及其绑定。
 *
 * 幂等：所有插入前以唯一编码（permission.code / role.code / menu name+parent）查重。
 * 角色绑定：
 *   - SUPER_ADMIN：绑定全部权限 + 全部菜单
 *   - ADMIN：绑定除 RBAC 写操作外的常规读权限（演示用最小集合）
 */
import { DataSource } from 'typeorm';
import {
  Permission,
  Role,
  Menu,
  MenuType,
  RolePermission,
  RoleMenu,
} from '@domains/access-control';

/** 基础权限点定义。code 为唯一键。 */
interface PermissionSeed {
  code: string;
  name: string;
  group: string;
}

/**
 * 权限点清单 —— 与 apps/admin-api 各 Controller 的 `@Permissions()` 逐一对应。
 *
 * 命名约定：`<资源>:<动作>`，动作可带连字符（如 assign-role）。
 * AccessCheckService 为精确匹配（无通配符展开），因此 Controller 标注的每个
 * 权限码都必须在此登记，否则除非角色显式绑定该码，接口将拒绝访问。
 *
 * 标注 [未接线] 的为标准 CRUD 目录项，当前尚无对应端点，预留给后续接口。
 */
export const PERMISSION_SEEDS: PermissionSeed[] = [
  // RBAC — 终端用户（/admin/users）
  { code: 'rbac:user:read', name: '用户-查看', group: 'rbac' },
  { code: 'rbac:user:create', name: '用户-创建', group: 'rbac' }, // [未接线]
  { code: 'rbac:user:update', name: '用户-更新', group: 'rbac' },
  { code: 'rbac:user:delete', name: '用户-删除', group: 'rbac' }, // [未接线]
  // RBAC — 管理员（/admin/administrators）
  { code: 'rbac:admin:read', name: '管理员-查看', group: 'rbac' },
  { code: 'rbac:admin:create', name: '管理员-创建', group: 'rbac' },
  { code: 'rbac:admin:update', name: '管理员-更新', group: 'rbac' },
  { code: 'rbac:admin:delete', name: '管理员-删除', group: 'rbac' }, // [未接线]
  { code: 'rbac:admin:assign-role', name: '管理员-分配角色', group: 'rbac' },
  {
    code: 'rbac:admin:reset-password',
    name: '管理员-重置密码',
    group: 'rbac',
  },
  // RBAC — 角色（/admin/roles）
  { code: 'rbac:role:read', name: '角色-查看', group: 'rbac' },
  { code: 'rbac:role:create', name: '角色-创建', group: 'rbac' },
  { code: 'rbac:role:update', name: '角色-更新', group: 'rbac' },
  { code: 'rbac:role:delete', name: '角色-删除', group: 'rbac' },
  {
    code: 'rbac:role:assign-permission',
    name: '角色-分配权限',
    group: 'rbac',
  },
  { code: 'rbac:role:assign-menu', name: '角色-分配菜单', group: 'rbac' },
  // RBAC — 权限（/admin/permissions）
  { code: 'rbac:permission:read', name: '权限-查看', group: 'rbac' },
  { code: 'rbac:permission:create', name: '权限-创建', group: 'rbac' },
  { code: 'rbac:permission:update', name: '权限-更新', group: 'rbac' },
  { code: 'rbac:permission:delete', name: '权限-删除', group: 'rbac' }, // [未接线]
  // RBAC — 菜单（/admin/menus）
  { code: 'rbac:menu:read', name: '菜单-查看', group: 'rbac' },
  { code: 'rbac:menu:create', name: '菜单-创建', group: 'rbac' },
  { code: 'rbac:menu:update', name: '菜单-更新', group: 'rbac' },
  { code: 'rbac:menu:delete', name: '菜单-删除', group: 'rbac' },
  // 系统配置（/admin/system-configs）
  { code: 'sys:config:read', name: '系统配置-查看', group: 'system' },
  { code: 'sys:config:create', name: '系统配置-创建', group: 'system' }, // [未接线] set 端点用 update
  { code: 'sys:config:update', name: '系统配置-设置', group: 'system' },
  { code: 'sys:config:delete', name: '系统配置-删除', group: 'system' },
  // 字典（/admin/dictionaries，含字典项）
  { code: 'sys:dict:read', name: '字典-查看', group: 'system' },
  { code: 'sys:dict:create', name: '字典-创建', group: 'system' },
  { code: 'sys:dict:update', name: '字典-更新', group: 'system' },
  { code: 'sys:dict:delete', name: '字典-删除', group: 'system' }, // [未接线]
  // 审计（/admin/operation-logs）
  { code: 'audit:log:read', name: '操作日志-查看', group: 'audit' },
  // 任务（/admin/tasks）
  { code: 'task:read', name: '任务-查看', group: 'task' },
  { code: 'task:retry', name: '任务-重试', group: 'task' },
  { code: 'task:trigger', name: '任务-触发', group: 'task' },
];

/** 基础角色定义。code 为唯一键。 */
interface RoleSeed {
  code: string;
  name: string;
  description: string;
}

export const ROLE_SEEDS: Record<'SUPER_ADMIN' | 'ADMIN', RoleSeed> = {
  SUPER_ADMIN: {
    code: 'SUPER_ADMIN',
    name: '超级管理员',
    description: '系统内置超级管理员，拥有全部权限',
  },
  ADMIN: {
    code: 'ADMIN',
    name: '管理员',
    description: '系统内置管理员，拥有常规读权限',
  },
};

/** ADMIN 角色的基础权限集合（各资源只读 + 任务查看）。 */
const ADMIN_PERMISSION_CODES = [
  'rbac:user:read',
  'rbac:admin:read',
  'rbac:role:read',
  'rbac:permission:read',
  'rbac:menu:read',
  'sys:config:read',
  'sys:dict:read',
  'audit:log:read',
  'task:read',
];

/** 基础菜单树定义（以临时 key 构建父子关系）。 */
interface MenuSeed {
  key: string;
  parentKey: string | null;
  name: string;
  path: string | null;
  icon: string | null;
  sort: number;
  type: MenuType;
}

export const MENU_SEEDS: MenuSeed[] = [
  {
    key: 'dashboard',
    parentKey: null,
    name: '仪表盘',
    path: '/dashboard',
    icon: 'dashboard',
    sort: 0,
    type: MenuType.MENU,
  },
  {
    key: 'rbac',
    parentKey: null,
    name: '权限管理',
    path: null,
    icon: 'safety',
    sort: 10,
    type: MenuType.DIRECTORY,
  },
  {
    key: 'rbac.users',
    parentKey: 'rbac',
    name: '用户管理',
    path: '/users',
    icon: 'user',
    sort: 0,
    type: MenuType.MENU,
  },
  {
    key: 'rbac.roles',
    parentKey: 'rbac',
    name: '角色管理',
    path: '/roles',
    icon: 'team',
    sort: 1,
    type: MenuType.MENU,
  },
  {
    key: 'rbac.permissions',
    parentKey: 'rbac',
    name: '权限点',
    path: '/permissions',
    icon: 'key',
    sort: 2,
    type: MenuType.MENU,
  },
  {
    key: 'rbac.menus',
    parentKey: 'rbac',
    name: '菜单管理',
    path: '/menus',
    icon: 'menu',
    sort: 3,
    type: MenuType.MENU,
  },
  {
    key: 'system',
    parentKey: null,
    name: '系统管理',
    path: null,
    icon: 'setting',
    sort: 20,
    type: MenuType.DIRECTORY,
  },
  {
    key: 'system.configs',
    parentKey: 'system',
    name: '系统配置',
    path: '/system-configs',
    icon: 'control',
    sort: 0,
    type: MenuType.MENU,
  },
  {
    key: 'system.dicts',
    parentKey: 'system',
    name: '数据字典',
    path: '/dictionaries',
    icon: 'book',
    sort: 1,
    type: MenuType.MENU,
  },
  {
    key: 'audit',
    parentKey: null,
    name: '审计日志',
    path: '/operation-logs',
    icon: 'audit',
    sort: 30,
    type: MenuType.MENU,
  },
  {
    key: 'tasks',
    parentKey: null,
    name: '任务中心',
    path: '/tasks',
    icon: 'schedule',
    sort: 40,
    type: MenuType.MENU,
  },
];

/**
 * 执行权限 / 角色 / 菜单 seed。返回 SUPER_ADMIN 角色 uid，供 seed-admin 绑定。
 */
export async function seedPermissions(
  dataSource: DataSource,
): Promise<{ superAdminRoleUid: string }> {
  const permissionRepo = dataSource.getRepository(Permission);
  const roleRepo = dataSource.getRepository(Role);
  const menuRepo = dataSource.getRepository(Menu);
  const rolePermRepo = dataSource.getRepository(RolePermission);
  const roleMenuRepo = dataSource.getRepository(RoleMenu);

  console.log('  [permissions] 填充权限点...');
  const permByCode = new Map<string, Permission>();
  for (const seed of PERMISSION_SEEDS) {
    let perm = await permissionRepo.findOne({ where: { code: seed.code } });
    if (!perm) {
      perm = await permissionRepo.save(
        permissionRepo.create({
          code: seed.code,
          name: seed.name,
          group: seed.group,
        }),
      );
      console.log(`    + 权限 ${seed.code}`);
    }
    permByCode.set(seed.code, perm);
  }

  console.log('  [permissions] 填充角色...');
  const superAdmin = await upsertRole(roleRepo, ROLE_SEEDS.SUPER_ADMIN);
  const admin = await upsertRole(roleRepo, ROLE_SEEDS.ADMIN);

  console.log('  [permissions] 填充菜单树...');
  const menuByKey = new Map<string, Menu>();
  // 第一遍：创建节点（不含 parent）。
  for (const seed of MENU_SEEDS) {
    let menu = await menuRepo.findOne({
      where: { name: seed.name, type: seed.type },
    });
    if (!menu) {
      menu = await menuRepo.save(
        menuRepo.create({
          name: seed.name,
          path: seed.path,
          icon: seed.icon,
          sort: seed.sort,
          type: seed.type,
          parentId: null,
        }),
      );
      console.log(`    + 菜单 ${seed.key}`);
    }
    menuByKey.set(seed.key, menu);
  }
  // 第二遍：回填 parentId（引用父节点 uid）。
  for (const seed of MENU_SEEDS) {
    if (!seed.parentKey) continue;
    const menu = menuByKey.get(seed.key)!;
    const parent = menuByKey.get(seed.parentKey);
    if (parent && menu.parentId !== parent.uid) {
      menu.parentId = parent.uid;
      await menuRepo.save(menu);
    }
  }

  // SUPER_ADMIN: 绑定全部权限 + 全部菜单。
  await bindRolePermissions(
    rolePermRepo,
    superAdmin.uid,
    [...permByCode.values()].map((p) => p.uid),
  );
  await bindRoleMenus(
    roleMenuRepo,
    superAdmin.uid,
    [...menuByKey.values()].map((m) => m.uid),
  );

  // ADMIN: 绑定只读权限子集 + 全部菜单（可见但操作受权限限制）。
  const adminPermUids = ADMIN_PERMISSION_CODES.map(
    (c) => permByCode.get(c)?.uid,
  ).filter((u): u is string => Boolean(u));
  await bindRolePermissions(rolePermRepo, admin.uid, adminPermUids);
  await bindRoleMenus(
    roleMenuRepo,
    admin.uid,
    [...menuByKey.values()].map((m) => m.uid),
  );

  console.log('  [permissions] 完成。');
  return { superAdminRoleUid: superAdmin.uid };
}

async function upsertRole(
  repo: import('typeorm').Repository<Role>,
  seed: RoleSeed,
): Promise<Role> {
  let role = await repo.findOne({ where: { code: seed.code } });
  if (!role) {
    role = await repo.save(
      repo.create({
        code: seed.code,
        name: seed.name,
        description: seed.description,
        isSystem: true,
      }),
    );
    console.log(`    + 角色 ${seed.code}`);
  }
  return role;
}

async function bindRolePermissions(
  repo: import('typeorm').Repository<RolePermission>,
  roleId: string,
  permissionIds: string[],
): Promise<void> {
  for (const permissionId of permissionIds) {
    const exists = await repo.findOne({ where: { roleId, permissionId } });
    if (!exists) {
      await repo.save(repo.create({ roleId, permissionId }));
    }
  }
}

async function bindRoleMenus(
  repo: import('typeorm').Repository<RoleMenu>,
  roleId: string,
  menuIds: string[],
): Promise<void> {
  for (const menuId of menuIds) {
    const exists = await repo.findOne({ where: { roleId, menuId } });
    if (!exists) {
      await repo.save(repo.create({ roleId, menuId }));
    }
  }
}
