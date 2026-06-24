import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigType } from '@nestjs/config';
import { jwtConfig } from '@core/config';
import type {
  RefreshAuthUser,
  RefreshTokenPayload,
} from '../types/jwt-payload.interface';

/** Refresh Token cookie 名称。 */
const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';

interface RequestWithCookies {
  cookies?: Record<string, string | undefined>;
}

/**
 * 从请求中提取 Refresh Token：
 * 1. 优先尝试 `Authorization: Bearer <token>` 头；
 * 2. 退回到 HttpOnly Cookie `refresh_token`。
 */
function extractRefreshToken(req: RequestWithCookies): string | null {
  const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(
    req as Parameters<
      ReturnType<typeof ExtractJwt.fromAuthHeaderAsBearerToken>
    >[0],
  );
  if (fromHeader) {
    return fromHeader;
  }
  return req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] ?? null;
}

/**
 * Refresh Token 校验策略（passport 名称：'refresh-jwt'）。
 *
 * 使用 refresh 密钥校验，从 Bearer 头或 `refresh_token` cookie 提取原始 token，
 * 并将其作为 `rawToken` 一并返回，供上层做 hash 比对 / Token 轮换。
 */
@Injectable()
export class RefreshJwtStrategy extends PassportStrategy(
  Strategy,
  'refresh-jwt',
) {
  constructor(@Inject(jwtConfig.KEY) cfg: ConfigType<typeof jwtConfig>) {
    super({
      jwtFromRequest: extractRefreshToken,
      ignoreExpiration: false,
      secretOrKey: cfg.refreshSecret,
      passReqToCallback: true,
    });
  }

  validate(
    req: RequestWithCookies,
    payload: RefreshTokenPayload,
  ): RefreshAuthUser {
    const rawToken = extractRefreshToken(req) ?? '';
    return {
      sub: payload.sub,
      jti: payload.jti,
      pv: payload.pv,
      typ: 'refresh',
      rawToken,
    };
  }
}
