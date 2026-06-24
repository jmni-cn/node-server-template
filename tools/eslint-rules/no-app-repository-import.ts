/**
 * ESLint 规则：no-app-repository-import
 *
 * 禁止在 apps/ 下直接使用 TypeORM repository：
 *   - import { Repository } from 'typeorm'
 *   - import { InjectRepository } from '@nestjs/typeorm'
 *   - import { getRepository } from 'typeorm'
 *
 * apps 必须调用 domain/platform service，而非直接持有 repository。
 * 仅对路径包含 `/apps/` 的文件生效。
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

const FORBIDDEN: Record<string, string[]> = {
  typeorm: ['Repository', 'getRepository', 'getManager', 'getConnection'],
  '@nestjs/typeorm': ['InjectRepository'],
};

const rule: RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: '禁止在 apps/ 中直接导入/使用 TypeORM repository（应调用域/平台 service）' },
    schema: [],
    messages: {
      forbidden:
        "apps 层禁止直接使用 '{{name}}'（来自 {{source}}）。请调用 domain/platform service，必要时在域库新增方法并从 index.ts 导出。",
    },
  },
  create(context) {
    const filename: string = context.getFilename().replace(/\\/g, '/');
    // 仅作用于 apps/ 下文件。
    if (!/\/apps\//.test(filename)) {
      return {};
    }
    return {
      ImportDeclaration(node: any) {
        const source: string = node.source.value;
        const banned = FORBIDDEN[source];
        if (!banned) return;
        for (const spec of node.specifiers ?? []) {
          const name = spec.imported?.name ?? spec.local?.name;
          if (name && banned.includes(name)) {
            context.report({ node: spec, messageId: 'forbidden', data: { name, source } });
          }
        }
      },
    };
  },
};

export = rule;
