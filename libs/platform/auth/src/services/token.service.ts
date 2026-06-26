import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigType } from '@nestjs/config';
import { jwtConfig } from '@core/config';
import { BusinessException } from '@core/common';
import { AuthErrorCode } from '../constants/auth-error-codes';
import { calculateExpiresAt, parseExpiresIn } from '../utils/jwt.utils';
import type {
  AdminJwtPayload,
  RefreshTokenPayload,
  UserJwtPayload,
} from '../types/jwt-payload.interface';

/** Access Token payload（admin 或 user）。 */
type AccessPayload = AdminJwtPayload | UserJwtPayload;

/**
 * Token 服务
 *
 * 负责签发 / 校验 / 解码 Access 与 Refresh Token，
 * 密钥与过期时间来自 `@core/config` 的 `jwtConfig`。
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly cfg: ConfigType<typeof jwtConfig>,
  ) {}

  /**
   * 签发 Access Token（接受 admin 或 user payload）。
   */
  signAccessToken(payload: AccessPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.cfg.accessSecret,
      // 显式锁定签名算法，与校验侧一致，防止算法混淆。
      algorithm: 'HS256',
      // expiresIn 统一传数值秒，避免依赖 @nestjs/jwt 的字符串解析与 ms 类型
      expiresIn: parseExpiresIn(this.cfg.accessExpiresIn),
    });
  }

  /**
   * 签发 Refresh Token。
   */
  signRefreshToken(payload: RefreshTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.cfg.refreshSecret,
      algorithm: 'HS256',
      expiresIn: parseExpiresIn(this.cfg.refreshExpiresIn),
    });
  }

  /**
   * 一次性签发 Access + Refresh 双 Token（并行签名）。
   *
   * 根据 `remember` 选择普通 / 「记住我」过期时间，解析为数值秒后并行签名，
   * 并返回 token 与计算好的过期信息，便于上层写入会话 / Cookie。
   */
  async issueTokens(input: {
    access: AccessPayload;
    refresh: RefreshTokenPayload;
    remember?: boolean;
  }): Promise<{
    accessToken: string;
    refreshToken: string;
    accessExpiresInSeconds: number;
    refreshExpiresInSeconds: number;
    refreshExpiresAt: Date;
  }> {
    const accessExpiresInSeconds = parseExpiresIn(
      input.remember
        ? this.cfg.rememberAccessExpiresIn
        : this.cfg.accessExpiresIn,
    );
    const refreshExpiresInSeconds = parseExpiresIn(
      input.remember
        ? this.cfg.rememberRefreshExpiresIn
        : this.cfg.refreshExpiresIn,
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(input.access, {
        secret: this.cfg.accessSecret,
        algorithm: 'HS256',
        expiresIn: accessExpiresInSeconds,
      }),
      this.jwtService.signAsync(input.refresh, {
        secret: this.cfg.refreshSecret,
        algorithm: 'HS256',
        expiresIn: refreshExpiresInSeconds,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      accessExpiresInSeconds,
      refreshExpiresInSeconds,
      refreshExpiresAt: calculateExpiresAt(refreshExpiresInSeconds),
    };
  }

  /**
   * 校验 Access Token；失败抛 `TOKEN_ACCESS_INVALID`。
   */
  verifyAccessToken<T extends object = AccessPayload>(token: string): T {
    try {
      return this.jwtService.verify<T>(token, {
        secret: this.cfg.accessSecret,
        // 仅接受 HS256，拒绝 alg=none 及非对称算法降级。
        algorithms: ['HS256'],
      });
    } catch {
      throw new BusinessException(AuthErrorCode.TOKEN_ACCESS_INVALID);
    }
  }

  /**
   * 校验 Refresh Token；失败抛 `TOKEN_REFRESH_INVALID`。
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      return this.jwtService.verify<RefreshTokenPayload>(token, {
        secret: this.cfg.refreshSecret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new BusinessException(AuthErrorCode.TOKEN_REFRESH_INVALID);
    }
  }

  /**
   * 组装管理后台 Access Token payload。
   */
  buildAdminPayload(params: {
    sub: string;
    username: string | null;
    jti: string;
    pv: number;
    roleUids: string[];
    permissionCodes: string[];
  }): AdminJwtPayload {
    return {
      sub: params.sub,
      username: params.username,
      jti: params.jti,
      pv: params.pv,
      typ: 'admin',
      roleUids: params.roleUids,
      permissionCodes: params.permissionCodes,
    };
  }

  /**
   * 组装用户端 Access Token payload。
   */
  buildUserPayload(params: {
    sub: string;
    username: string | null;
    jti: string;
    pv: number;
  }): UserJwtPayload {
    return {
      sub: params.sub,
      username: params.username,
      jti: params.jti,
      pv: params.pv,
      typ: 'user',
    };
  }

  /**
   * 组装 Refresh Token payload。
   */
  buildRefreshPayload(params: {
    sub: string;
    jti: string;
    pv: number;
  }): RefreshTokenPayload {
    return {
      sub: params.sub,
      jti: params.jti,
      pv: params.pv,
      typ: 'refresh',
    };
  }

  /**
   * 解码 Token（不校验签名）。
   */
  decode<T = unknown>(token: string): T | null {
    return this.jwtService.decode(token);
  }
}
