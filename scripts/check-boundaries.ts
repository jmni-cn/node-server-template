#!/usr/bin/env node
/**
 * check:boundaries — 校验 apps 层边界。
 *
 * 依赖无关：仅用 node fs + 正则。
 *
 * 检查项：
 *   1) apps/**\/*.ts 中禁止直接使用 TypeORM repository：
 *      - import { ... Repository ... } from 'typeorm' / getRepository / getManager / getConnection
 *      - import { InjectRepository } from '@nestjs/typeorm'
 *      - 类型用法 `Repository<...>`、调用 `getRepository(`、装饰器 `@InjectRepository(`
 *   2) 跨 app 导入：当前 app 文件导入了另一个 app（相对越界或 'apps/<other>' 别名）。
 *
 * 命中打印 file:line，存在违规以退出码 1 结束。
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const APPS_DIR = path.join(ROOT, 'apps');
const EXCLUDE_DIR_NAMES = new Set(['node_modules', 'dist', '.git']);

interface Violation {
  file: string;
  line: number;
  rule: string;
  text: string;
}

/** 解析路径所属 app 名（apps/<name>/...）。 */
function appOf(absPath: string): string | null {
  const m = absPath.replace(/\\/g, '/').match(/\/apps\/([^/]+)\//);
  return m ? m[1] : null;
}

function listTsFiles(dir: string, out: string[]): void {
  let entries: any[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (EXCLUDE_DIR_NAMES.has(e.name)) continue;
      listTsFiles(path.join(dir, e.name), out);
    } else if (e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) {
      out.push(path.join(dir, e.name));
    }
  }
}

// repository 使用模式。
const REPO_PATTERNS: Array<{ rule: string; re: RegExp }> = [
  { rule: 'repository-import', re: /import\s+[^;]*\bInjectRepository\b[^;]*from\s+['"]@nestjs\/typeorm['"]/ },
  { rule: 'repository-import', re: /import\s+[^;]*\b(getRepository|getManager|getConnection)\b[^;]*from\s+['"]typeorm['"]/ },
  { rule: 'repository-import', re: /import\s+[^;]*\bRepository\b[^;]*from\s+['"]typeorm['"]/ },
  { rule: 'repository-decorator', re: /@InjectRepository\s*\(/ },
  { rule: 'repository-call', re: /\bgetRepository\s*\(/ },
  { rule: 'repository-type', re: /\bRepository\s*</ },
];

const IMPORT_RE = /(?:import\s[^'"]*from\s*|import\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

function checkFile(file: string, violations: Violation[]): void {
  let content: string;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  const rel = path.relative(ROOT, file);
  const app = appOf(file);
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // (1) repository 使用。
    for (const { rule, re } of REPO_PATTERNS) {
      if (re.test(line)) {
        violations.push({ file: rel, line: i + 1, rule, text: line.trim() });
        break;
      }
    }

    // (2) 跨 app 导入。
    let m: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(line)) !== null) {
      const spec = m[1];
      if (isCrossAppImport(file, app, spec)) {
        violations.push({ file: rel, line: i + 1, rule: 'cross-app-import', text: line.trim() });
      }
    }
  }
}

function isCrossAppImport(file: string, app: string | null, spec: string): boolean {
  if (!app) return false;
  const s = spec.replace(/\\/g, '/');
  // 相对路径：解析后判断目标 app。
  if (s.startsWith('.')) {
    const resolved = path.resolve(path.dirname(file), s).replace(/\\/g, '/') + '/';
    const target = appOf(resolved);
    return Boolean(target && target !== app);
  }
  // 别名 / 裸路径含 apps/<other>。
  const am = s.match(/(?:^|\/)apps\/([^/]+)/);
  return Boolean(am && am[1] !== app);
}

function main(): void {
  if (!fs.existsSync(APPS_DIR)) {
    console.log('[check:boundaries] 跳过 — 未发现 apps/ 目录。');
    process.exit(0);
  }
  const files: string[] = [];
  listTsFiles(APPS_DIR, files);

  const violations: Violation[] = [];
  for (const f of files) checkFile(f, violations);

  if (violations.length === 0) {
    console.log('[check:boundaries] OK — apps 边界无违规。');
    process.exit(0);
  }

  console.error(`[check:boundaries] 发现 ${violations.length} 处违规：`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.rule}]  ${v.text}`);
  }
  process.exit(1);
}

main();
