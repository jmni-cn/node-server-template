import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';
import {
  createTypeOrmOptions,
  databaseConfigFromEnv,
} from './typeorm-options.factory';

/**
 * TypeORM CLI 数据源（migration / seed 使用）。
 *
 * 环境变量加载优先级：env/<APP_NAME>.local.env > env/<APP_NAME>.env > 真实环境变量。
 * 实体通过 glob 'libs/ ** /*.entity.ts' 收集；迁移位于 'database/migrations'。
 */
const appName = process.env.APP_NAME || 'admin-api';
dotenv.config({ path: join(process.cwd(), 'env', `${appName}.local.env`) });
dotenv.config({ path: join(process.cwd(), 'env', `${appName}.env`) });

export const dataSourceOptions = createTypeOrmOptions(databaseConfigFromEnv(), {
  entities: [
    // 各特性 lib / app 中的实体
    join(process.cwd(), 'libs', '**', '*.entity.{ts,js}'),
    join(process.cwd(), 'apps', '**', '*.entity.{ts,js}'),
  ],
  migrations: [join(process.cwd(), 'database', 'migrations', '*.{ts,js}')],
});

/**
 * 默认导出数据源实例（TypeORM CLI 约定）。
 */
const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
