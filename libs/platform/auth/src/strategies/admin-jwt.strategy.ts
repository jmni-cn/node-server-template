import { Inject, Injectable, Optional } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigType } from '@nestjs/config';
import { jwtConfig } from '@core/config';
import { BusinessException } from '@core/common';
import { AuthErrorCode } from '../constants/auth-error-codes';
import {
  ACCESS_SESSION_VALIDATOR,
  type AccessSessionValidator,
} from '../constants/access-session-validator.token';
import { TokenBlacklistService } from '../services/token-blacklist.service';
import type {
  AdminAuthUser,
  AdminJwtPayload,
} from '../types/jwt-payload.interface';

/**
 * 管理后台 Access Token 校验策略（passport 名称：'admin-jwt'）。
 *
 * 从 `Authorization: Bearer <token>` 提取 Access Token，使用 access 密钥
 * （锁定 HS256 算法）校验，随后：
 * 1. 校验 payload.typ==='admin' 及必填字段（sub/jti 为 string、pv 为 number）；
 * 2. 校验 jti 不在 Token 黑名单（登出 / 强制下线）；
 * 3. 若绑定了 `ACCESS_SESSION_VALIDATOR` 端口，则校验会话/用户/密码版本实时有效；
 * 4. 将 payload 映射为 `AdminAuthUser` 注入到 `request.user`。
 */
@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    @Inject(jwtConfig.KEY) cfg: ConfigType<typeof jwtConfig>,
    private readonly tokenBlacklist: TokenBlacklistService,
    @Optional()
    @Inject(ACCESS_SESSION_VALIDATOR)
    private readonly sessionValidator?: AccessSessionValidator,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.accessSecret,
      // 显式锁定签名算法，防止算法混淆攻击（如 alg=none / 非对称降级）。
      algorithms: ['HS256'],
    });
  }

  async validate(payload: AdminJwtPayload): Promise<AdminAuthUser> {
    // 1) 类型与必填字段校验。
    if (
      payload?.typ !== 'admin' ||
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string' ||
      typeof payload.pv !== 'number'
    ) {
      throw new BusinessException(AuthErrorCode.AUTH_UNAUTHORIZED);
    }

    // 2) Token 黑名单校验（按 jti）。
    if (await this.tokenBlacklist.isBlacklisted(payload.jti)) {
      throw new BusinessException(AuthErrorCode.AUTH_UNAUTHORIZED);
    }

    // 3) 可选会话/用户/密码版本实时校验（端口未绑定时跳过，保持向后兼容）。
    if (this.sessionValidator) {
      await this.sessionValidator.validateAccess({
        subjectType: 'admin',
        sub: payload.sub,
        jti: payload.jti,
        pv: payload.pv,
      });
    }

    return {
      sub: payload.sub,
      username: payload.username,
      jti: payload.jti,
      pv: payload.pv,
      typ: 'admin',
      exp: payload.exp,
      roleUids: payload.roleUids,
      permissionCodes: payload.permissionCodes,
    };
  }
}
