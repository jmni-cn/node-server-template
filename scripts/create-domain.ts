#!/usr/bin/env node
/**
 * create-domain — 脚手架一个新的 @domains/<name> 域库骨架。
 *
 * 用法：ts-node scripts/create-domain.ts <name>
 *   <name> 域名（kebab-case，如 billing、catalog）
 *
 * 从 tools/generators/domain-template 复制并替换占位符（__name__/__Name__/__NAME__）。
 * 生成结构：
 *   libs/domains/<name>/
 *     src/entities/<name>.entity.ts + index.ts
 *     src/services/<name>.service.ts + index.ts
 *     src/<name>.module.ts
 *     src/index.ts
 *     tsconfig.lib.json
 *     README.md
 *   并补充空的 dto/ vo/ mapper/ assembler/ types/ constants/ 占位目录（含 .gitkeep）。
 *
 * 生成后需手动接入（见生成的 README 与下方提示）。
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = process.cwd();
const EMPTY_DIRS = ['dto', 'vo', 'mapper', 'assembler', 'types', 'constants'];

function fail(msg: string): never {
  console.error(`[create-domain] ${msg}`);
  process.exit(1);
}

function toPascal(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

function toConstant(name: string): string {
  return name.replace(/[-\s]+/g, '_').toUpperCase();
}

function applyTokens(text: string, name: string): string {
  return text
    .replace(/__NAME__/g, toConstant(name))
    .replace(/__Name__/g, toPascal(name))
    .replace(/__name__/g, name);
}

function copyTemplate(
  srcDir: string,
  destDir: string,
  name: string,
  created: string[],
): void {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  fs.mkdirSync(destDir, { recursive: true });
  for (const e of entries) {
    const srcPath = path.join(srcDir, e.name);
    const renamed = applyTokens(e.name.replace(/\.tpl$/, ''), name);
    const destPath = path.join(destDir, renamed);
    if (e.isDirectory()) {
      copyTemplate(srcPath, destPath, name, created);
    } else {
      const content = applyTokens(fs.readFileSync(srcPath, 'utf8'), name);
      fs.writeFileSync(destPath, content, 'utf8');
      created.push(path.relative(ROOT, destPath));
    }
  }
}

function main(): void {
  const [name] = process.argv.slice(2);
  if (!name) fail('用法: ts-node scripts/create-domain.ts <name>');
  if (!/^[a-z][a-z0-9-]*$/.test(name)) fail('<name> 必须为 kebab-case');

  const templateDir = path.join(ROOT, 'tools', 'generators', 'domain-template');
  if (!fs.existsSync(templateDir))
    fail('未找到模板: tools/generators/domain-template');

  const libDir = path.join(ROOT, 'libs', 'domains', name);
  if (fs.existsSync(libDir)) fail(`目标已存在: libs/domains/${name}`);

  // template 内容（entities/、services/、*.module、index、tsconfig、README）落到 src/ 与库根。
  // 约定：模板顶层文件 index.ts.tpl/__name__.module.ts.tpl/*.entity 等放入 src/，
  //       tsconfig.lib.json.tpl / README.md.tpl 放入库根。
  const created: string[] = [];
  const srcDir = path.join(libDir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });

  const entries = fs.readdirSync(templateDir, { withFileTypes: true });
  for (const e of entries) {
    const srcPath = path.join(templateDir, e.name);
    const baseName = applyTokens(e.name.replace(/\.tpl$/, ''), name);
    const goesToRoot =
      baseName === 'tsconfig.lib.json' || baseName === 'README.md';
    const destDir = goesToRoot ? libDir : srcDir;
    if (e.isDirectory()) {
      copyTemplate(srcPath, path.join(srcDir, e.name), name, created);
    } else {
      const content = applyTokens(fs.readFileSync(srcPath, 'utf8'), name);
      const destPath = path.join(destDir, baseName);
      fs.writeFileSync(destPath, content, 'utf8');
      created.push(path.relative(ROOT, destPath));
    }
  }

  // 补充空目录占位。
  for (const d of EMPTY_DIRS) {
    const dir = path.join(srcDir, d);
    fs.mkdirSync(dir, { recursive: true });
    const keep = path.join(dir, '.gitkeep');
    fs.writeFileSync(keep, '', 'utf8');
    created.push(path.relative(ROOT, keep));
  }

  console.log(`[create-domain] 已生成 libs/domains/${name}：`);
  for (const f of created) console.log(`  + ${f}`);

  const Pascal = toPascal(name);
  console.log('\n接入清单（请手动完成）：');
  console.log(
    `  1) tsconfig.base.json paths 添加 "@domains/${name}" 与 "@domains/${name}/*"`,
  );
  console.log(
    `  2) nest-cli.json projects 添加 "${name}" 库项（tsConfigPath 指向 libs/domains/${name}/tsconfig.lib.json）`,
  );
  console.log(`  3) jest moduleNameMapper 补充新别名`);
  console.log(`  4) 在用到的 app AppModule 引入 ${Pascal}Module`);
}

main();
