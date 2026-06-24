/**
 * 公开接口装饰器 re-export。
 *
 * `Public` 与 `IS_PUBLIC_KEY` 的真实定义位于 `@core/common`；
 * 这里 re-export 以便应用代码可统一从 `@platform/auth` 导入。
 *
 * @example
 * ```typescript
 * @Public()
 * @Post('login')
 * async login() { ... }
 * ```
 */
export { Public, IS_PUBLIC_KEY } from '@core/common';
