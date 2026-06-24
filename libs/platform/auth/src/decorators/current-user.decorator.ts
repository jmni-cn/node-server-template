import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { BaseAuthUser } from '../types/jwt-payload.interface';

/**
 * 当前用户装饰器
 * 用于获取当前登录用户信息
 *
 * @example
 * ```typescript
 * // 获取完整用户信息
 * @Get('profile')
 * getProfile(@CurrentUser() user: AdminAuthUser) { ... }
 *
 * // 只获取特定字段（使用标准字段名）
 * @Get('uid')
 * getUid(@CurrentUser('sub') uid: string) { ... }
 * ```
 */
export const CurrentUser = createParamDecorator(
  <T extends BaseAuthUser>(
    data: keyof T | undefined,
    ctx: ExecutionContext,
  ) => {
    const request = ctx.switchToHttp().getRequest<{ user?: T }>();
    const user = request.user;

    if (data) {
      return user?.[data];
    }
    return user;
  },
);
