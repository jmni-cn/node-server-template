import { Module } from '@nestjs/common';
import { LoggerModule } from '@core/logger';
import { registerErrorCodeHttpStatus } from '@core/common';
import {
  ConfigRuntimeModule,
  registerConfigDefinitions,
  SystemConfigType,
} from '@platform/config';
import { SecurityErrorCodeHttpStatus } from './constants/security-error-codes';
import { SECURITY_CONFIG_KEYS } from './constants/config-keys';
import { RateLimitService } from './rate-limit/rate-limit.service';
import { RateLimitGuard } from './rate-limit/rate-limit.guard';
import { PasswordHasherService } from './password/password-hasher.service';
import { PasswordPolicyService } from './password/password-policy.service';
import { DeviceInfoService } from './device/device-info.service';
import { IpBlacklistService } from './ip/ip-blacklist.service';
import { IpBlacklistGuard } from './ip/ip-blacklist.guard';

// Register HTTP status mapping for security error codes at module load time.
registerErrorCodeHttpStatus(SecurityErrorCodeHttpStatus);

// 模块加载即注册安全/风控运行时配置定义（DB 覆盖 → 代码默认 两层）。
// 默认值即基线（与 SECURITY_DEFAULTS / 历史硬编码保持一致），如需调整走 DB 覆盖热更新。
registerConfigDefinitions([
  {
    key: SECURITY_CONFIG_KEYS.LOGIN_MAX_FAILED,
    group: 'security',
    label: '登录最大失败次数',
    description: '触发账户锁定的连续登录失败阈值',
    valueType: SystemConfigType.NUMBER,
    defaultValue: 5,
  },
  {
    key: SECURITY_CONFIG_KEYS.LOGIN_LOCK_MINUTES,
    group: 'security',
    label: '账户锁定时长（分钟）',
    description: '连续登录失败达阈值后锁定账户的时长（分钟）',
    valueType: SystemConfigType.NUMBER,
    defaultValue: 15,
  },
  {
    key: SECURITY_CONFIG_KEYS.IP_SUSPICIOUS_WINDOW_SECONDS,
    group: 'security',
    label: 'IP 风控滑动窗口（秒）',
    description: '同 IP 登录失败累计的滑动窗口时长（秒）',
    valueType: SystemConfigType.NUMBER,
    defaultValue: 3600,
  },
  {
    key: SECURITY_CONFIG_KEYS.IP_SUSPICIOUS_THRESHOLD,
    group: 'security',
    label: 'IP 自动封禁阈值',
    description: '窗口内同 IP 登录失败累计触发自动封禁的阈值',
    valueType: SystemConfigType.NUMBER,
    defaultValue: 20,
  },
  {
    key: SECURITY_CONFIG_KEYS.IP_BAN_SECONDS,
    group: 'security',
    label: 'IP 自动封禁时长（秒）',
    description: '触发自动封禁后该 IP 的封禁时长（秒）',
    valueType: SystemConfigType.NUMBER,
    defaultValue: 3600,
  },
]);

/**
 * Security module.
 *
 * Provides rate limiting, IP blacklisting, password hashing/policy and device
 * info parsing.
 *
 * Note: depends on the global CacheModule (RedisService). Ensure CacheModule
 * is imported in AppModule.
 */
@Module({
  imports: [LoggerModule, ConfigRuntimeModule],
  providers: [
    RateLimitService,
    RateLimitGuard,
    PasswordHasherService,
    PasswordPolicyService,
    DeviceInfoService,
    IpBlacklistService,
    IpBlacklistGuard,
  ],
  exports: [
    RateLimitService,
    RateLimitGuard,
    PasswordHasherService,
    PasswordPolicyService,
    DeviceInfoService,
    IpBlacklistService,
    IpBlacklistGuard,
  ],
})
export class SecurityModule {}
