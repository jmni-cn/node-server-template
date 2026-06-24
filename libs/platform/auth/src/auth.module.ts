import { DynamicModule, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LoggerModule } from '@core/logger';
import { CacheModule } from '@platform/cache';
import { registerErrorCodeHttpStatus } from '@core/common';
import { AuthErrorCodeHttpStatus } from './constants/auth-error-codes';
import { TokenService } from './services/token.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { UserJwtStrategy } from './strategies/user-jwt.strategy';
import { RefreshJwtStrategy } from './strategies/refresh-jwt.strategy';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { UserJwtAuthGuard } from './guards/user-jwt-auth.guard';
import { RefreshJwtAuthGuard } from './guards/refresh-jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';

// 静态注册认证模块的错误码 → HTTP 状态映射（全局生效）。
registerErrorCodeHttpStatus(AuthErrorCodeHttpStatus);

/**
 * @platform/auth — 平台认证模块。
 *
 * 提供 JWT 签发 / 校验、Token 黑名单、passport 策略（admin-jwt / user-jwt /
 * refresh-jwt）、认证守卫与 RBAC 权限守卫等共享认证基础设施。
 *
 * 【ACCESS_CHECKER 约定】
 * `PermissionsGuard` 依赖 `ACCESS_CHECKER` 端口判定权限，本模块**不**提供默认
 * 实现（否则会引入对 @domains 的依赖）。使用 `PermissionsGuard` 的应用必须自行
 * 提供实现：
 *
 * ```typescript
 * import { ACCESS_CHECKER, AuthModule } from '@platform/auth';
 *
 * @Module({
 *   imports: [AuthModule.forRoot()],
 *   providers: [
 *     { provide: ACCESS_CHECKER, useClass: MyRbacAccessChecker },
 *   ],
 * })
 * export class AppAuthModule {}
 * ```
 *
 * JwtModule 以空配置注册（密钥/过期时间在每次签名时按 jwtConfig 传入），
 * CacheModule 通常已在根模块以 @Global 方式导入，这里一并 import 以保证
 * RedisService 可用。
 */
@Module({})
export class AuthModule {
  static forRoot(): DynamicModule {
    return {
      module: AuthModule,
      imports: [JwtModule.register({}), LoggerModule, CacheModule],
      providers: [
        TokenService,
        TokenBlacklistService,
        AdminJwtStrategy,
        UserJwtStrategy,
        RefreshJwtStrategy,
        AdminJwtAuthGuard,
        UserJwtAuthGuard,
        RefreshJwtAuthGuard,
        PermissionsGuard,
      ],
      exports: [
        TokenService,
        TokenBlacklistService,
        AdminJwtStrategy,
        UserJwtStrategy,
        RefreshJwtStrategy,
        AdminJwtAuthGuard,
        UserJwtAuthGuard,
        RefreshJwtAuthGuard,
        PermissionsGuard,
      ],
    };
  }
}
