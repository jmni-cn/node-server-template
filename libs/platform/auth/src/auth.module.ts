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
// 注意：PermissionsGuard 不在此模块 providers/exports 中（见下方说明），
// 它依赖 ACCESS_CHECKER（由应用提供），不能在 @platform/auth 上下文内被实例化。

// 静态注册认证模块的错误码 → HTTP 状态映射（全局生效）。
registerErrorCodeHttpStatus(AuthErrorCodeHttpStatus);

/**
 * @platform/auth — 平台认证模块。
 *
 * 提供 JWT 签发 / 校验、Token 黑名单、passport 策略（admin-jwt / user-jwt /
 * refresh-jwt）、认证守卫与 RBAC 权限守卫等共享认证基础设施。
 *
 * 【PermissionsGuard / ACCESS_CHECKER 约定】
 * `PermissionsGuard` 依赖 `ACCESS_CHECKER` 端口判定权限。
 *
 * 正确用法：在**应用根模块**导入提供 `ACCESS_CHECKER` 的模块（如
 * `@domains/access-control` 的 `AccessControlModule`，它 `{ provide: ACCESS_CHECKER,
 * useExisting: AccessCheckService }` 并导出），再把 `PermissionsGuard` 注册为全局
 * 守卫（在根上下文解析 ACCESS_CHECKER）：
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
      ],
    };
  }
}
