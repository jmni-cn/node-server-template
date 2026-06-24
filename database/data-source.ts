/**
 * Root TypeORM CLI 数据源（migration / seed / db:reset 使用）。
 *
 * 复用 @core/database 的连接选项工厂（createTypeOrmOptions + databaseConfigFromEnv），
 * 但在此覆盖 entities / migrations glob，使其相对于仓库根目录解析，
 * 供 package.json 中 `typeorm ... -d database/data-source.ts` 调用。
 *
 * 环境变量加载优先级：env/<APP_NAME>.local.env > env/<APP_NAME>.env > 真实环境变量。
 * - type: 'mysql'，驱动 mysql2
 * - synchronize: false（所有 schema 变更通过 migration 管理）
 * - migrationsTableName: 'migrations'
 */
import { DataSource, type DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { createTypeOrmOptions, databaseConfigFromEnv } from '@core/database';

// 环境变量加载（脱离 Nest DI 容器，供 CLI 使用）。
const appName = process.env.APP_NAME || 'admin-api';
dotenv.config({ path: join(process.cwd(), 'env', `${appName}.local.env`) });
dotenv.config({ path: join(process.cwd(), 'env', `${appName}.env`) });

/**
 * CLI 数据源选项。
 *
 * entities glob 同时覆盖 TS 源码（ts-node 运行）与编译产物（dist 下 js）。
 * migrations 仅匹配本目录下的 *.ts（CLI 在 ts-node 下运行）。
 */
export const dataSourceOptions: DataSourceOptions = {
  ...createTypeOrmOptions(databaseConfigFromEnv(), {
    entities: [
      join(process.cwd(), 'libs', '**', '*.entity.ts'),
      join(process.cwd(), 'apps', '**', '*.entity.ts'),
      join(process.cwd(), 'dist', 'libs', '**', '*.entity.js'),
      join(process.cwd(), 'dist', 'apps', '**', '*.entity.js'),
    ],
    migrations: [join(process.cwd(), 'database', 'migrations', '*.ts')],
  }),
  // 覆盖迁移表名为 'migrations'（与本模板约定一致）。
  migrationsTableName: 'migrations',
};

/**
 * 默认导出数据源实例（TypeORM CLI 约定）。
 */
const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
