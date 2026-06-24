import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { BusinessException, IS_PUBLIC_KEY } from '@core/common';
import { AuthErrorCode } from '../constants/auth-error-codes';

/**
 * 管理后台 Access Token 守卫（passport 策略：'admin-jwt'）。
 *
 * 支持 `@Public()` 装饰器标记的接口跳过认证；认证失败抛出
 * `BusinessException(AuthErrorCode.AUTH_UNAUTHORIZED)`。
 */
@Injectable()
export class AdminJwtAuthGuard extends AuthGuard('admin-jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw new BusinessException(AuthErrorCode.AUTH_UNAUTHORIZED);
    }
    return user;
  }
}
