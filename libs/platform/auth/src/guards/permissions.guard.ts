import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BusinessException, IS_PUBLIC_KEY } from '@core/common';
import { LoggerService } from '@core/logger';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthErrorCode } from '../constants/auth-error-codes';
import {
  ACCESS_CHECKER,
  type AccessChecker,
} from '../constants/access-checker.token';
import {
  SECURITY_EVENT_RECORDER,
  type SecurityEventRecorder,
} from '../constants/security-event-recorder.token';
import type { AdminAuthUser } from '../types/jwt-payload.interface';

/**
 * 权限守卫
 * 检查用户是否拥有 `@Permissions()` 标注的所需权限（仅适用于 admin-api）。
 *
 * 检查逻辑：
 * 1. 公开接口（`@Public()`）直接放行；
 * 2. 未设置权限要求的接口放行（仅需登录）；
 * 3. 通过注入的 `AccessChecker` 端口判定用户是否拥有所需权限。
 *
 * 注意：本守卫不直接依赖 @domains，权限判定委托给 `ACCESS_CHECKER`，
 * 由消费方应用提供 `{ provide: ACCESS_CHECKER, useClass: ... }`。
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: LoggerService,
    @Inject(ACCESS_CHECKER) private readonly accessChecker: AccessChecker,
    @Optional()
    @Inject(SECURITY_EVENT_RECORDER)
    private readonly securityEventRecorder?: SecurityEventRecorder,
  ) {
    this.logger.setContext(PermissionsGuard.name);
  }

  /**
   * 记录一条 ACCESS_DENIED 安全事件（端口未绑定或失败均静默，不影响鉴权）。
   */
  private recordAccessDenied(payload: {
    userId?: string | null;
    method?: string;
    path?: string;
    handler: string;
    required: string[];
    reason: string;
  }): void {
    if (!this.securityEventRecorder) return;
    try {
      void Promise.resolve(
        this.securityEventRecorder.record('ACCESS_DENIED', {
          userId: payload.userId ?? null,
          riskLevel: 'medium',
          metadata: {
            method: payload.method ?? null,
            path: payload.path ?? null,
            handler: payload.handler,
            required: payload.required,
            reason: payload.reason,
          },
        }),
      ).catch(() => undefined);
    } catch {
      // 记录失败不影响鉴权
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否为公开接口
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // 获取所需权限
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 没有设置权限要求，则允许访问（仅需登录）
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AdminAuthUser; method?: string; url?: string }>();
    const user = request.user;
    const handler = `${context.getClass().name}.${context.getHandler().name}`;

    if (!user || !user.sub) {
      this.logger.warn(
        `PERM_DENIED: 用户信息缺失 | ${request.method ?? '-'} ${request.url ?? '-'} | handler=${handler} | required=[${requiredPermissions.join(', ')}]`,
      );
      this.recordAccessDenied({
        userId: user?.sub ?? null,
        method: request.method,
        path: request.url,
        handler,
        required: requiredPermissions,
        reason: 'missing_user',
      });
      throw new BusinessException(AuthErrorCode.PERM_DENIED);
    }

    const allowed = await this.accessChecker.hasPermissions(
      user.sub,
      requiredPermissions,
    );

    if (!allowed) {
      this.logger.warn(
        `PERM_DENIED: 权限不足 | ${request.method ?? '-'} ${request.url ?? '-'} | handler=${handler} | user=${user.sub} | required=[${requiredPermissions.join(', ')}]`,
      );
      this.recordAccessDenied({
        userId: user.sub,
        method: request.method,
        path: request.url,
        handler,
        required: requiredPermissions,
        reason: 'insufficient_permissions',
      });
      throw new BusinessException(AuthErrorCode.PERM_DENIED);
    }

    return true;
  }
}
