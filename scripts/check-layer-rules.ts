#!/usr/bin/env node
/**
 * check:layers — 校验 lib 分层导入方向与基本目录/命名约定。
 *
 * 依赖无关：仅用 node fs + 正则。
 *
 * 导入方向（按 import 路径别名判断）：
 *   core        -> 仅可 @core
 *   platform    -> @core, @platform
 *   domains     -> @core, @platform           （禁止 @domains 兄弟、@integrations、apps）
 *   integrations-> @core, @platform, @domains  （禁止 apps）
 *
 * 命名/目录基本检查（针对 libs/**）：
 *   - *.entity.ts 必须位于 entities/ 目录下
 *   - *.vo.ts 必须位于 vo/ 目录下
 *   - *.dto.ts 必须位于 dto/ 目录下
 *   - *.mapper.ts 必须位于 mapper/ 目录下
 *
 * 说明：不强制 *.service.ts 位于 services/ —— core/平台库允许在 src 根放置单一 service
 * （如 logger.service.ts / cache.service.ts），仅域库按 services/ 分层组织，二者均合规。
 *
 * 命中打印 file:line（命名检查无行号，记为 0），存在违规以退出码 1 结束。
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const LIBS_DIR = path.join(ROOT, 'libs');
const EXCLUDE_DIR_NAMES = new Set(['node_modules', 'dist', '.git']);

type Layer = 'core' | 'platform' | 'domains' | 'integrations';

/** 各层允许导入的目标别名根集合。 */
const ALLOWED: Record<Layer, Set<string>> = {
  core: new Set(['@core']),
  platform: new Set(['@core', '@platform']),
  domains: new Set(['@core', '@platform']),
  integrations: new Set(['@core', '@platform', '@domains']),
};

interface Violation {
  file: string;
  line: number;
  rule: string;
  text: string;
}

/** 解析文件所属层与库名：libs/<layer>/<libName>/... */
function layerOf(absPath: string): { layer: Layer; lib: string } | null {
  const m = absPath
    .replace(/\\/g, '/')
    .match(/\/libs\/(core|platform|domains|integrations)\/([^/]+)\//);
  if (!m) return null;
  return { layer: m[1] as Layer, lib: m[2] };
}

/** 解析 import spec 的别名根（@core/@platform/@domains/@integrations）。 */
function aliasRootOf(spec: string): string | null {
  const m = spec.match(/^(@core|@platform|@domains|@integrations)(?:\/|$)/);
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

const IMPORT_RE = /(?:import\s[^'"]*from\s*|import\s*|require\s*\(\s*|export\s[^'"]*from\s*)['"]([^'"]+)['"]/g;

// 角色后缀 -> 期望所在目录段。
const DIR_RULES: Array<{ suffix: string; dir: string }> = [
  { suffix: '.entity.ts', dir: 'entities' },
  { suffix: '.vo.ts', dir: 'vo' },
  { suffix: '.dto.ts', dir: 'dto' },
  { suffix: '.mapper.ts', dir: 'mapper' },
];

function checkFile(file: string, violations: Violation[]): void {
  const info = layerOf(file);
  if (!info) return;
  const rel = path.relative(ROOT, file);
  const relUnix = rel.replace(/\\/g, '/');

  // ---- 目录/命名检查 ----
  for (const rule of DIR_RULES) {
    if (relUnix.endsWith(rule.suffix)) {
      if (!relUnix.includes('/' + rule.dir + '/')) {
        violations.push({
          file: rel,
          line: 0,
          rule: 'dir-naming',
          text: rule.suffix + ' 文件应位于 ' + rule.dir + '/ 目录下',
        });
      }
    }
  }

  // ---- 导入方向检查 ----
  let content: string;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  const allowed = ALLOWED[info.layer];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(line)) !== null) {
      const root = aliasRootOf(m[1]);
      if (!root) continue; // 非分层别名（相对/第三方）忽略。
      if (!allowed.has(root)) {
        violations.push({
          file: rel,
          line: i + 1,
          rule: 'layer-import(' + info.layer + ' !-> ' + root + ')',
          text: line.trim(),
        });
      } else if (root === '@domains' && info.layer === 'domains') {
        // domains 不得互引其它 domains 兄弟（同层禁止）。
        const sib = m[1].match(/^@domains\/([^/]+)/);
        if (sib && sib[1] !== info.lib) {
          violations.push({
            file: rel,
            line: i + 1,
            rule: 'domains-sibling-import',
            text: line.trim(),
          });
        }
      }
    }
  }
}

function main(): void {
  if (!fs.existsSync(LIBS_DIR)) {
    console.log('[check:layers] 跳过 — 未发现 libs/ 目录。');
    process.exit(0);
  }
  const files: string[] = [];
  listTsFiles(LIBS_DIR, files);

  const violations: Violation[] = [];
  for (const f of files) checkFile(f, violations);

  if (violations.length === 0) {
    console.log('[check:layers] OK — 分层导入与目录约定无违规。');
    process.exit(0);
  }

  console.error('[check:layers] 发现 ' + violations.length + ' 处违规：');
  for (const v of violations) {
    const loc = v.line > 0 ? v.file + ':' + v.line : v.file;
    console.error('  ' + loc + '  [' + v.rule + ']  ' + v.text);
  }
  process.exit(1);
}

main();
