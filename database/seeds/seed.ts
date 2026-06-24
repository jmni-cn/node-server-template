/**
 * seed — 种子数据编排器。
 *
 * 按顺序执行：seed-permissions → seed-admin → seed-system-configs → seed-dictionaries。
 * 全程使用同一个已初始化的 DataSource，结束后关闭连接。
 *
 * 运行：`npm run seed`（cross-env APP_NAME=admin-api ts-node ... database/seeds/seed.ts）
 *
 * 所有子 seed 均幂等，可重复运行。
 */
import dataSource from '../data-source';
import { seedPermissions } from './seed-permissions';
import { seedAdmin } from './seed-admin';
import { seedSystemConfigs } from './seed-system-configs';
import { seedDictionaries } from './seed-dictionaries';

export async function runSeeds(): Promise<void> {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  console.log('开始填充种子数据...');
  try {
    // 1) 权限 / 角色 / 菜单 —— 返回 SUPER_ADMIN 角色 uid 供 admin 绑定。
    const { superAdminRoleUid } = await seedPermissions(dataSource);
    // 2) 管理员账户（依赖 SUPER_ADMIN 角色）。
    await seedAdmin(dataSource, superAdminRoleUid);
    // 3) 系统配置。
    await seedSystemConfigs(dataSource);
    // 4) 数据字典。
    await seedDictionaries(dataSource);
    console.log('种子数据填充完成。');
  } finally {
    await dataSource.destroy();
  }
}

// 作为脚本直接运行时执行。
if (require.main === module) {
  runSeeds()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('种子数据填充失败:', err);
      process.exit(1);
    });
}
