import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigType } from '@nestjs/config';
import { jwtConfig } from '@core/config';
import type {
  UserAuthUser,
  UserJwtPayload,
} from '../types/jwt-payload.interface';

/**
 * 用户端 Access Token 校验策略（passport 名称：'user-jwt'）。
 *
 * 从 `Authorization: Bearer <token>` 提取 Access Token，使用 access 密钥校验，
 * 并将 payload 映射为 `UserAuthUser` 注入到 `request.user`。
 */
@Injectable()
export class UserJwtStrategy extends PassportStrategy(Strategy, 'user-jwt') {
  constructor(@Inject(jwtConfig.KEY) cfg: ConfigType<typeof jwtConfig>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.accessSecret,
    });
  }

  validate(payload: UserJwtPayload): UserAuthUser {
    return {
      sub: payload.sub,
      username: payload.username,
      jti: payload.jti,
      pv: payload.pv,
      typ: 'user',
    };
  }
}
