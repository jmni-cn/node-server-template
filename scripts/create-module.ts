#!/usr/bin/env node
/**
 * create-module — 在指定 app 下脚手架一个功能模块。
 *
 * 用法：ts-node scripts/create-module.ts <app> <name>
 *   <app>  目标应用：admin-api | user-api | worker（任意已存在的 apps/<app>）
 *   <name> 模块名（kebab-case，如 billing、user-points）
 *
 * 从 tools/generators/module-template 复制并替换占位符：
 *   __name__  -> kebab-case 名（billing-account）
 *   __Name__  -> PascalCase 名（BillingAccount）
 *   __NAME__  -> CONSTANT_CASE 名（BILLING_ACCOUNT）
 * .tpl 后缀会被去除。
 *
 * 产物：apps/<app>/src/modules/<name>/<name>.controller.ts、<name>.module.ts、dto/、vo/
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = process.cwd();

function fail(msg: string): never {
  console.error(`[create-module] ${msg}`);
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

function copyTemplate(srcDir: string, destDir: string, name: string): string[] {
  const created: string[] = [];
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  fs.mkdirSync(destDir, { recursive: true });
  for (const e of entries) {
    const srcPath = path.join(srcDir, e.name);
    const renamed = applyTokens(e.name.replace(/\.tpl$/, ''), name);
    const destPath = path.join(destDir, renamed);
    if (e.isDirectory()) {
      created.push(...copyTemplate(srcPath, destPath, name));
    } else if (e.name === '.gitkeep') {
      fs.mkdirSync(destDir, { recursive: true });
    } else {
      const content = applyTokens(fs.readFileSync(srcPath, 'utf8'), name);
      fs.writeFileSync(destPath, content, 'utf8');
      created.push(path.relative(ROOT, destPath));
    }
  }
  return created;
}

function main(): void {
  const [app, name] = process.argv.slice(2);
  if (!app || !name)
    fail('用法: ts-node scripts/create-module.ts <app> <name>');
  if (!/^[a-z][a-z0-9-]*$/.test(name)) fail('<name> 必须为 kebab-case');

  const appDir = path.join(ROOT, 'apps', app);
  if (!fs.existsSync(appDir)) fail(`未找到 app: apps/${app}`);

  const templateDir = path.join(ROOT, 'tools', 'generators', 'module-template');
  if (!fs.existsSync(templateDir))
    fail('未找到模板: tools/generators/module-template');

  const destDir = path.join(appDir, 'src', 'modules', name);
  if (fs.existsSync(destDir))
    fail(`目标已存在: apps/${app}/src/modules/${name}`);

  const created = copyTemplate(templateDir, destDir, name);
  console.log(`[create-module] 已在 apps/${app}/src/modules/${name} 生成：`);
  for (const f of created) console.log(`  + ${f}`);
  console.log(
    '\n提醒：将 ' +
      toPascal(name) +
      'Module 注入到 apps/' +
      app +
      ' 的 AppModule.imports。',
  );
}

main();
