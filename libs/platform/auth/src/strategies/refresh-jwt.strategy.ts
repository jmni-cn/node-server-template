import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigType } from '@nestjs/config';
import { jwtConfig } from '@core/config';
import { BusinessException } from '@core/common';
import { AuthErrorCode } from '../constants/auth-error-codes';
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
 * 从请求中提取 Refresh Token。
 *
 * 默认仅从 HttpOnly Cookie `refresh_token` 提取（XSS 下 JS 无法读取，安全性更高）。
 * 仅当配置 `jwt.refreshFromAuthHeader=true`（env: JWT_REFRESH_FROM_AUTH_HEADER）时，
 * 才退回尝试 `Authorization: Bearer <token>` 头——用于无 Cookie 的纯 API / 移动端场景。
 */
function extractRefreshToken(
  req: RequestWithCookies,
  allowAuthHeader: boolean,
): string | null {
  const fromCookie = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] ?? null;
  if (fromCookie) {
    return fromCookie;
  }
  if (allowAuthHeader) {
    return (
      ExtractJwt.fromAuthHeaderAsBearerToken()(
        req as Parameters<
          ReturnType<typeof ExtractJwt.fromAuthHeaderAsBearerToken>
        >[0],
      ) ?? null
    );
  }
  return null;
}

/**
 * Refresh Token 校验策略（passport 名称：'refresh-jwt'）。
 *
 * 使用 refresh 密钥（锁定 HS256）校验，默认仅从 `refresh_token` cookie 提取原始 token，
 * 校验 `typ==='refresh'` 后将其作为 `rawToken` 一并返回，供上层做 hash 比对 / Token 轮换。
 */
@Injectable()
export class RefreshJwtStrategy extends PassportStrategy(
  Strategy,
  'refresh-jwt',
) {
  private readonly allowAuthHeader: boolean;

  constructor(@Inject(jwtConfig.KEY) cfg: ConfigType<typeof jwtConfig>) {
    const allowAuthHeader = cfg.refreshFromAuthHeader;
    super({
      jwtFromRequest: (req: RequestWithCookies) =>
        extractRefreshToken(req, allowAuthHeader),
      ignoreExpiration: false,
      secretOrKey: cfg.refreshSecret,
      algorithms: ['HS256'],
      passReqToCallback: true,
    });
    this.allowAuthHeader = allowAuthHeader;
  }

  validate(
    req: RequestWithCookies,
    payload: RefreshTokenPayload,
  ): RefreshAuthUser {
    // 类型与必填字段校验：拒绝把 access token 当作 refresh token 使用。
    if (
      payload?.typ !== 'refresh' ||
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string' ||
      typeof payload.pv !== 'number'
    ) {
      throw new BusinessException(AuthErrorCode.TOKEN_REFRESH_INVALID);
    }

    const rawToken = extractRefreshToken(req, this.allowAuthHeader) ?? '';
    return {
      sub: payload.sub,
      jti: payload.jti,
      pv: payload.pv,
      typ: 'refresh',
      rawToken,
    };
  }
}
