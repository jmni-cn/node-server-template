import { Module } from '@nestjs/common';
import { LoggerModule } from '@core/logger';
import { registerErrorCodeHttpStatus } from '@core/common';
import { SecurityErrorCodeHttpStatus } from './constants/security-error-codes';
import { RateLimitService } from './rate-limit/rate-limit.service';
import { RateLimitGuard } from './rate-limit/rate-limit.guard';
import { PasswordHasherService } from './password/password-hasher.service';
import { PasswordPolicyService } from './password/password-policy.service';
import { DeviceInfoService } from './device/device-info.service';
import { IpBlacklistService } from './ip/ip-blacklist.service';
import { IpBlacklistGuard } from './ip/ip-blacklist.guard';

// Register HTTP status mapping for security error codes at module load time.
registerErrorCodeHttpStatus(SecurityErrorCodeHttpStatus);

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
  imports: [LoggerModule],
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
