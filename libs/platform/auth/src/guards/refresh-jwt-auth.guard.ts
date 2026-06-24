import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BusinessException } from '@core/common';
import { AuthErrorCode } from '../constants/auth-error-codes';

/**
 * Refresh Token 守卫（passport 策略：'refresh-jwt'）。
 *
 * 刷新端点不需要 `@Public()` 跳过逻辑；校验失败抛出
 * `BusinessException(AuthErrorCode.TOKEN_REFRESH_INVALID)`。
 */
@Injectable()
export class RefreshJwtAuthGuard extends AuthGuard('refresh-jwt') {
  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw new BusinessException(AuthErrorCode.TOKEN_REFRESH_INVALID);
    }
    return user;
  }
}
