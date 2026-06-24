#!/usr/bin/env node
/**
 * create-migration — 创建一个带时间戳的空迁移文件。
 *
 * 用法：ts-node scripts/create-migration.ts <Name>
 *   <Name> 迁移名（PascalCase 或 kebab，如 AddUserPhoneIndex）
 *
 * 薄封装：调用 TypeORM CLI 的 `migration:create`，输出到 database/migrations/<ts>-<Name>.ts。
 * TypeORM 的 migration:create 会自行在文件名前加时间戳，这里传入基础路径即可。
 */
import { spawnSync } from 'child_process';
import * as path from 'path';

const ROOT = process.cwd();

function fail(msg: string): never {
  console.error(`[create-migration] ${msg}`);
  process.exit(1);
}

function main(): void {
  const [name] = process.argv.slice(2);
  if (!name) fail('用法: ts-node scripts/create-migration.ts <Name>');
  if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(name))
    fail('<Name> 仅允许字母数字与连字符');

  // migration:create 接收的是「路径前缀」，CLI 会拼接时间戳生成 <ts>-<Name>.ts。
  const target = path.join('database', 'migrations', name);

  const cli = path.join('node_modules', 'typeorm', 'cli.js');
  const args = [
    '-r',
    'tsconfig-paths/register',
    cli,
    'migration:create',
    target,
  ];

  console.log(`[create-migration] typeorm migration:create ${target}`);
  const res = spawnSync('ts-node', args, {
    stdio: 'inherit',
    cwd: ROOT,
    shell: process.platform === 'win32',
    env: { ...process.env, APP_NAME: process.env.APP_NAME ?? 'admin-api' },
  });
  process.exit(res.status ?? 1);
}

main();
