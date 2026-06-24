#!/usr/bin/env node
/**
 * seed（脚本入口）— 运行 database/seeds/seed.ts 的编排器。
 *
 * 保持简单：直接导入并调用 runSeeds()。package.json 的 `seed` 脚本已直接指向
 * database/seeds/seed.ts；本文件提供 scripts/ 下的统一入口（如 CI 调用约定）。
 */
import { runSeeds } from '../database/seeds/seed';

runSeeds()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed] 失败:', err);
    process.exit(1);
  });
