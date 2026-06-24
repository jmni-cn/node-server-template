import { SetMetadata } from '@nestjs/common';

/** 公开接口元数据键（守卫读取此键判断是否跳过认证） */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 公开接口装饰器。
 * 用于标注不需要认证的接口（配合 JWT 守卫使用）。
 *
 * @example
 * ```typescript
 * @Public()
 * @Post('login')
 * async login() { ... }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
