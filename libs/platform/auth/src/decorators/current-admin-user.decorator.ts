import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AdminAuthUser } from '../types/jwt-payload.interface';

/**
 * 当前管理后台用户装饰器
 * 用于获取当前登录的管理后台用户信息（已通过 admin-jwt 校验）。
 *
 * @example
 * ```typescript
 * @Get('profile')
 * getProfile(@CurrentAdminUser() user: AdminAuthUser) { ... }
 *
 * @Get('uid')
 * getUid(@CurrentAdminUser('sub') uid: string) { ... }
 * ```
 */
export const CurrentAdminUser = createParamDecorator(
  (data: keyof AdminAuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AdminAuthUser }>();
    const user = request.user;

    if (data) {
      return user?.[data];
    }
    return user;
  },
);
