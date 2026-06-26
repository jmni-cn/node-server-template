/**
 * UserContextInterceptor — 鉴权后回填请求上下文中的用户信息。
 *
 * JWT 守卫 / 策略校验通过后会将用户信息注入到 `request.user`，
 * 但 RequestContext（AsyncLocalStorage）在中间件阶段建立时尚无用户信息。
 * 本拦截器在守卫之后、控制器之前执行，将 sub/username/jti 回填到上下文，
 * 使后续日志 / 审计 / 安全事件无需显式透传即可携带操作人信息。
 *
 * 仅在已认证（request.user 存在）时写入；公开接口不受影响。
 */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { FastifyRequest } from 'fastify';
import { RequestContextService } from '@core/request-context';
import type { BaseAuthUser } from '../types/jwt-payload.interface';

@Injectable()
export class UserContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: Partial<BaseAuthUser> }>();

    const user = request.user;
    if (user?.sub) {
      RequestContextService.setUser({
        sub: user.sub,
        username: user.username ?? '',
        jti: user.jti,
      });
    }

    return next.handle();
  }
}
