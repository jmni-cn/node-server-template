/**
 * seed-admin — 创建超级管理员账户及其凭证，并绑定 SUPER_ADMIN 角色。
 *
 * 默认凭证（模板基础数据，生产环境务必首次登录后修改）：
 *   username: admin
 *   password: Admin@123456
 *
 * 管理员存于 admin_users；凭证存于 user_credentials（subject_type='admin'）；
 * 管理员不需要资料（UserProfile 为终端用户专用）。
 *
 * 幂等：以 username 查重；存在则跳过创建，仍确保凭证与角色绑定。
 */
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AdminUser, UserStatus, UserCredential } from '@domains/identity';
import { Role, UserRole } from '@domains/access-control';

/** 默认超级管理员凭证。 */
export const ADMIN_USERNAME = 'admin';
export const ADMIN_EMAIL = 'admin@example.com';
export const ADMIN_PASSWORD = 'Admin@123456';
const ADMIN_SUBJECT_TYPE = 'admin';
const BCRYPT_ROUNDS = 10;

/**
 * 执行管理员 seed。
 * @param superAdminRoleUid SUPER_ADMIN 角色 uid（由 seed-permissions 返回）。
 *   若未提供则按 code='SUPER_ADMIN' 查询。
 */
export async function seedAdmin(
  dataSource: DataSource,
  superAdminRoleUid?: string,
): Promise<void> {
  const adminRepo = dataSource.getRepository(AdminUser);
  const credRepo = dataSource.getRepository(UserCredential);
  const roleRepo = dataSource.getRepository(Role);
  const userRoleRepo = dataSource.getRepository(UserRole);

  console.log('  [admin] 创建超级管理员...');

  let admin = await adminRepo.findOne({ where: { username: ADMIN_USERNAME } });
  if (!admin) {
    admin = await adminRepo.save(
      adminRepo.create({
        username: ADMIN_USERNAME,
        email: ADMIN_EMAIL,
        status: UserStatus.ACTIVE,
      }),
    );
    console.log(`    + 管理员 ${ADMIN_USERNAME} (${admin.uid})`);
  } else {
    console.log(`    - 管理员 ${ADMIN_USERNAME} 已存在，跳过`);
  }

  // 凭证（subject_type='admin'，按 subjectType+userId 查重）。bcryptjs 哈希。
  const cred = await credRepo.findOne({
    where: { subjectType: ADMIN_SUBJECT_TYPE, userId: admin.uid },
  });
  if (!cred) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
    await credRepo.save(
      credRepo.create({
        subjectType: ADMIN_SUBJECT_TYPE,
        userId: admin.uid,
        passwordHash,
        passwordUpdatedAt: new Date(),
      }),
    );
    console.log('    + 管理员凭证（bcryptjs）');
  }

  // 解析 SUPER_ADMIN 角色 uid。
  let roleUid = superAdminRoleUid;
  if (!roleUid) {
    const role = await roleRepo.findOne({ where: { code: 'SUPER_ADMIN' } });
    roleUid = role?.uid;
  }
  if (!roleUid) {
    console.warn(
      '    ! 未找到 SUPER_ADMIN 角色，跳过绑定（请先运行 seed-permissions）',
    );
    return;
  }

  // 绑定管理员-角色（UserRole.userId = AdminUser uid，按 userId+roleId 查重）。
  const bind = await userRoleRepo.findOne({
    where: { userId: admin.uid, roleId: roleUid },
  });
  if (!bind) {
    await userRoleRepo.save(
      userRoleRepo.create({ userId: admin.uid, roleId: roleUid }),
    );
    console.log('    + 绑定 SUPER_ADMIN 角色');
  }

  console.log('  [admin] 完成。');
}
