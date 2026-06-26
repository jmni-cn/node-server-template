import { Injectable, CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { BusinessException } from '@core/common';
import { RequestContextService } from '@core/request-context';
import { SecurityErrorCode } from '../constants/security-error-codes';
import { RATE_LIMIT_KEY, type RateLimitOptions } from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';

/**
 * Rate limiting guard.
 *
 * Reads {@link RateLimitOptions} metadata from the handler (then the class).
 * The IP is taken from {@link RequestContextService} (resolved in middleware)
 * to avoid being bypassed via forged headers.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options =
      this.reflector.get<RateLimitOptions | undefined>(
        RATE_LIMIT_KEY,
        context.getHandler(),
      ) ??
      this.reflector.get<RateLimitOptions | undefined>(
        RATE_LIMIT_KEY,
        context.getClass(),
      );

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();

    const ip = RequestContextService.getIp() ?? request.ip ?? 'unknown';
    const keyBy = options.keyBy ?? 'ip-path';

    // 路由标识：用 Controller 类名 + Handler 方法名，而非具体 URL。
    // 这样既能让每个端点拥有独立计数桶（同一 IP/用户打满 A 端点不会连带封 B），
    // 又避免把含路径参数值（如 /users/:id）的完整 path 做 key 导致 key 基数爆炸。
    const routeKey = `${context.getClass().name}.${context.getHandler().name}`;

    let key: string;
    switch (keyBy) {
      case 'ip':
        // 维度名 + IP + 路由，保证每端点独立计数。
        key = `ip:${ip}:${routeKey}`;
        break;
      case 'user': {
        // 维度名 + 用户(sub，缺失回退 IP) + 路由。
        const subject = RequestContextService.getSub() ?? ip;
        key = `user:${subject}:${routeKey}`;
        break;
      }
      case 'ip-path':
      default:
        // ip-path 语义不变：IP + 路由标识（用 handler 标识替代原始 path，避免路径参数撑爆 key）。
        key = `ip-path:${ip}:${routeKey}`;
        break;
    }

    const result = await this.rateLimitService.hit(
      key,
      options.windowMs,
      options.max,
    );

    response.header('X-RateLimit-Limit', String(options.max));
    response.header('X-RateLimit-Remaining', String(result.remaining));
    response.header('X-RateLimit-Reset', String(result.resetInSeconds));

    if (!result.allowed) {
      throw new BusinessException(SecurityErrorCode.RATE_LIMIT_EXCEEDED);
    }

    return true;
  }
}
