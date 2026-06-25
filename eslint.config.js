// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const globals = require('globals');

module.exports = tseslint.config(
  {
    ignores: ['eslint.config.js', 'dist/**', 'node_modules/**', '**/*.js'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  // 构建/工程化脚本与自定义 eslint 规则不纳入 TS 项目（tsconfig 未 include），
  // 关闭类型感知规则，避免 "not found by the project service" 解析报错。
  {
    files: ['scripts/**/*.ts', 'tools/**/*.ts'],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      // 工程化脚本与自定义 eslint 规则按 CommonJS 运行，允许 require()。
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
