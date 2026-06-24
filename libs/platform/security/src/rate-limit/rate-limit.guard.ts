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

    let key: string;
    switch (keyBy) {
      case 'ip':
        key = ip;
        break;
      case 'user':
        key = RequestContextService.getSub() ?? ip;
        break;
      case 'ip-path':
      default: {
        const path = request.url.split('?')[0];
        key = `${ip}:${path}`;
        break;
      }
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
