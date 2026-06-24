#!/usr/bin/env node
/* eslint-disable */
/**
 * copy-i18n.js
 *
 * 将 @core/i18n 的文案目录复制到构建产物目录，供运行时按目录加载：
 *   src:  libs/core/i18n/src/messages
 *   dst1: dist/apps/<APP_NAME>/i18n            （按应用拆分，与 nest build 产物对齐）
 *   dst2: dist/libs/core/i18n/messages         （lib 产物兜底路径）
 *
 * 设计为“韧性”脚本：源不存在时打印告警并以 0 退出，绝不让构建因文案缺失而失败。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'libs', 'core', 'i18n', 'src', 'messages');
const APP_NAME = process.env.APP_NAME || 'admin-api';

const DESTINATIONS = [
  path.join(ROOT, 'dist', 'apps', APP_NAME, 'i18n'),
  path.join(ROOT, 'dist', 'libs', 'core', 'i18n', 'messages'),
];

/** 递归复制目录（Node 16+ 优先用 fs.cpSync，回退手写实现） */
function copyRecursive(src, dst) {
  if (typeof fs.cpSync === 'function') {
    fs.cpSync(src, dst, { recursive: true });
    return;
  }
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.warn(`[copy-i18n] source not found, skipping: ${SRC}`);
    process.exit(0);
  }

  let copied = 0;
  for (const dst of DESTINATIONS) {
    try {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      copyRecursive(SRC, dst);
      copied += 1;
      console.log(`[copy-i18n] copied messages -> ${dst}`);
    } catch (err) {
      console.warn(
        `[copy-i18n] failed to copy to ${dst}: ${err && err.message ? err.message : err}`,
      );
    }
  }

  if (copied === 0) {
    console.warn('[copy-i18n] no destinations were written (non-fatal)');
  }
  process.exit(0);
}

main();
