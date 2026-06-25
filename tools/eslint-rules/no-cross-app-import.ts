/**
 * ESLint 规则：no-cross-app-import
 *
 * apps/* 之间相互隔离：admin-api / user-api / worker 不得互相导入。
 *
 * 检测两类导入：
 *   1) 相对路径越界到另一个 app 目录（如 admin-api 文件 import '../../user-api/...'）。
 *   2) 通过 @app 风格别名导入其它 app（如 import '@user/...'、'apps/user-api/...'）。
 *
 * 仅对路径包含 `/apps/<name>/` 的文件生效，<name> 为当前 app。
 */

type RuleModule = {
  meta: {
    type: 'problem';
    docs: { description: string };
    schema: unknown[];
    messages: Record<string, string>;
  };
  create: (context: any) => Record<string, (node: any) => void>;
};

import * as path from 'path';

/** 从文件绝对路径解析出所属 app 名（apps/<name>/...）。 */
function currentApp(filename: string): string | null {
  const m = filename.replace(/\\/g, '/').match(/\/apps\/([^/]+)\//);
  return m ? m[1] : null;
}

const rule: RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'apps 之间禁止相互导入（admin-api / user-api / worker 相互隔离）',
    },
    schema: [],
    messages: {
      crossApp:
        "禁止跨 app 导入：'{{importPath}}' 指向另一个 app（当前 app: {{app}}）。",
    },
  },
  create(context) {
    const filename: string = context.getFilename().replace(/\\/g, '/');
    const app = currentApp(filename);
    if (!app) return {};

    function check(node: any, importPath: string): void {
      if (!importPath) return;
      const normalized = importPath.replace(/\\/g, '/');

      // 1) 相对路径：解析为绝对路径后检查是否落入其它 app。
      if (normalized.startsWith('.')) {
        const resolved = path
          .resolve(path.dirname(filename), normalized)
          .replace(/\\/g, '/');
        const target = currentApp(resolved + '/');
        if (target && target !== app) {
          context.report({
            node,
            messageId: 'crossApp',
            data: { importPath, app },
          });
        }
        return;
      }

      // 2) 别名/裸路径：包含 apps/<other> 或 @<otherapp> 形式。
      const aliasMatch = normalized.match(/(?:^|\/)apps\/([^/]+)/);
      if (aliasMatch && aliasMatch[1] !== app) {
        context.report({
          node,
          messageId: 'crossApp',
          data: { importPath, app },
        });
      }
    }

    return {
      ImportDeclaration(node: any) {
        check(node.source, node.source.value);
      },
      // 动态 import('...') 与 require('...')
      ImportExpression(node: any) {
        if (node.source?.type === 'Literal')
          check(node.source, node.source.value);
      },
      CallExpression(node: any) {
        if (
          node.callee?.name === 'require' &&
          node.arguments?.[0]?.type === 'Literal'
        ) {
          check(node.arguments[0], node.arguments[0].value);
        }
      },
    };
  },
};

export default rule;
