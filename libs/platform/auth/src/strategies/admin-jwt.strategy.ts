import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigType } from '@nestjs/config';
import { jwtConfig } from '@core/config';
import type {
  AdminAuthUser,
  AdminJwtPayload,
} from '../types/jwt-payload.interface';

/**
 * 管理后台 Access Token 校验策略（passport 名称：'admin-jwt'）。
 *
 * 从 `Authorization: Bearer <token>` 提取 Access Token，使用 access 密钥校验，
 * 并将 payload 映射为 `AdminAuthUser` 注入到 `request.user`。
 */
@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(@Inject(jwtConfig.KEY) cfg: ConfigType<typeof jwtConfig>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.accessSecret,
    });
  }

  validate(payload: AdminJwtPayload): AdminAuthUser {
    return {
      sub: payload.sub,
      username: payload.username,
      jti: payload.jti,
      pv: payload.pv,
      typ: 'admin',
      roleUids: payload.roleUids,
      permissionCodes: payload.permissionCodes,
    };
  }
}
