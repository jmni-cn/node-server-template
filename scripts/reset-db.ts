#!/usr/bin/env node
/**
 * reset-db — 开发期数据库重置：DROP DATABASE + CREATE + 运行迁移 + 填充种子。
 *
 * 仅限开发！若 NODE_ENV === 'production' 直接拒绝。
 *
 * 流程：
 *   1) 用「无 database」连接执行 DROP/CREATE DATABASE（使用配置中的库名 + 字符集）。
 *   2) 初始化业务数据源并 runMigrations()。
 *   3) 调用 runSeeds() 填充模板基础数据。
 *
 * 运行：`npm run db:reset`（cross-env NODE_ENV=development APP_NAME=admin-api ts-node ...）。
 */
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { databaseConfigFromEnv } from '@core/database';
import appDataSource from '../database/data-source';
import { runSeeds } from '../database/seeds/seed';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[reset-db] 拒绝执行：NODE_ENV=production。该命令仅限开发环境。',
    );
    process.exit(1);
  }

  // 加载 env（与 data-source 一致）。
  const appName = process.env.APP_NAME || 'admin-api';
  dotenv.config({ path: join(process.cwd(), 'env', `${appName}.local.env`) });
  dotenv.config({ path: join(process.cwd(), 'env', `${appName}.env`) });

  const cfg = databaseConfigFromEnv();
  const dbName = cfg.database;
  const charset = cfg.charset ?? 'utf8mb4';

  console.log(`[reset-db] 目标数据库: ${dbName} @ ${cfg.host}:${cfg.port}`);

  // 1) 管理连接（不指定 database），DROP + CREATE。
  const admin = new DataSource({
    type: 'mysql',
    connectorPackage: 'mysql2',
    host: cfg.host,
    port: cfg.port,
    username: cfg.username,
    password: cfg.password,
  } as any);

  await admin.initialize();
  console.log('[reset-db] DROP DATABASE...');
  await admin.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  console.log('[reset-db] CREATE DATABASE...');
  await admin.query(
    `CREATE DATABASE \`${dbName}\` CHARACTER SET ${charset} COLLATE ${charset}_general_ci`,
  );
  await admin.destroy();

  // 2) 运行迁移。
  console.log('[reset-db] 运行迁移...');
  if (!appDataSource.isInitialized) {
    await appDataSource.initialize();
  }
  await appDataSource.runMigrations();
  await appDataSource.destroy();

  // 3) 填充种子（runSeeds 自行管理数据源连接生命周期）。
  console.log('[reset-db] 填充种子数据...');
  await runSeeds();

  console.log('[reset-db] 完成。');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[reset-db] 失败:', err);
    process.exit(1);
  });
