# tools/eslint-rules

本地自定义 ESLint 规则（P2 预设）。这些规则是 `scripts/check-*.ts` 在 IDE/CI 中的等价物，
让违规在编辑器内即时高亮。当前为**功能骨架**：可用，但有意保持轻量（基于 AST + 命名约定，
不做完整类型推断）。

## 规则

| 规则名 | 文件 | 作用 |
|--------|------|------|
| `local-rules/no-app-repository-import` | `no-app-repository-import.ts` | 禁止 `apps/` 直接导入 `Repository`/`getRepository`(typeorm) 或 `InjectRepository`(@nestjs/typeorm)。 |
| `local-rules/no-entity-response` | `no-entity-response.ts` | `*.controller.ts` 方法不得返回疑似实体（从 `@domains/*`、`@platform/*` 导入的裸 PascalCase 类型）。 |
| `local-rules/no-cross-app-import` | `no-cross-app-import.ts` | `apps/*` 之间禁止相互导入（相对越界 + `apps/<other>` 别名）。 |

## 接入 eslint.config.js（flat config）

规则以 TS 编写，需先经 ts 加载。两种方式：

1. **先编译**：`tsc tools/eslint-rules/*.ts`（或 ts-node 注册），在 config 中 `require` 产物。
2. **直接以 ts-node 运行 ESLint**：`node --loader ts-node/esm node_modules/.bin/eslint ...`。

示例（CommonJS flat config，假定已可加载 ts）：

```js
// eslint.config.js
const localRules = require('./tools/eslint-rules'); // 编译后或经 ts-node

module.exports = [
  // ...existing config...
  {
    files: ['apps/**/*.ts', 'libs/**/*.ts'],
    plugins: { 'local-rules': localRules },
    rules: {
      'local-rules/no-app-repository-import': 'error',
      'local-rules/no-entity-response': 'error',
      'local-rules/no-cross-app-import': 'error',
    },
  },
];
```

## 与 scripts/check-* 的关系

- `scripts/check-boundaries.ts` ≈ `no-app-repository-import` + `no-cross-app-import`
- `scripts/check-layer-rules.ts` 覆盖更广的分层方向约束

CI 以 `npm run check:all`（dependency-free 脚本）为准；ESLint 规则为开发期辅助。
