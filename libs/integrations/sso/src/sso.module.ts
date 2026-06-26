import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { registerErrorCodeHttpStatus } from '@core/common';
import { LoggerModule } from '@core/logger';
import {
  ConfigRuntimeModule,
  registerConfigDefinitions,
  SystemConfigType,
} from '@platform/config';
import { QueueModule, QUEUE_NAMES } from '@platform/queue';
import { IdentityModule } from '@domains/identity';
import { SsoProviderService } from './services/sso-provider.service';
import { ProviderProfileNormalizerService } from './services/provider-profile-normalizer.service';
import { SsoAuthorizeService } from './services/sso-authorize.service';
import { SsoCallbackService } from './services/sso-callback.service';
import { SsoStateService } from './services/sso-state.service';
import { SsoLoginCodeService } from './services/sso-login-code.service';
import { SsoErrorCodeHttpStatus, SSO_CONFIG_KEYS } from './constants';

// 模块加载时注册 SSO 错误码 → HTTP 状态映射。
registerErrorCodeHttpStatus(SsoErrorCodeHttpStatus);

// 模块加载即注册 SSO 自动开户策略的运行时配置定义（DB 覆盖 → 代码默认 两层）。
// 机密项（clientId/clientSecret 等）仍走纯 env，不在此注册；仅热更新「策略」类键。
registerConfigDefinitions([
  {
    key: SSO_CONFIG_KEYS.ALLOW_AUTO_REGISTER,
    group: 'sso',
    label: 'SSO 允许自动开户',
    description: '终端用户 SSO 首次登录是否允许自动开户',
    valueType: SystemConfigType.BOOLEAN,
    defaultValue: true,
    valueBehaviors: { true: 'auto_register', false: 'reject_new_user' },
  },
  {
    key: SSO_CONFIG_KEYS.ALLOWED_EMAIL_DOMAINS,
    group: 'sso',
    label: 'SSO 自动开户邮箱域白名单',
    description: '自动开户允许的邮箱域名单（数组，空数组表示不限制）',
    valueType: SystemConfigType.JSON,
    defaultValue: [],
    valueBehaviors: { '[]': 'unrestricted' },
  },
]);

/**
 * @integrations/sso — 第三方 OAuth2 / OIDC 单点登录集成。
 *
 * 作为 integration，可依赖 @core/* / @platform/* / @domains/*。这里导入
 * IdentityModule 以复用 AdminUserService / EndUserService / ExternalIdentityService /
 * RegisterService 完成 subjectType 感知的身份匹配、绑定与（仅终端用户）开户：
 * - subjectType='user' → 在 EndUser 域匹配，未命中自动开户；
 * - subjectType='admin' → 在 AdminUser 域匹配，绝不自动开户（SSO_ACCOUNT_NOT_FOUND）。
 *
 * Provider（oidc / microsoft / krafton）由 {@link SsoProviderService} 在
 * onModuleInit 时按各自配置块构造并注册（详见该服务），无需在此声明为 NestJS provider。
 * CacheService 来自全局 CacheModule（SsoStateService / SsoLoginCodeService 使用）。
 */
@Module({
  imports: [
    // ssoConfig 已通过 ConfigModule 全局注册；此处显式导入以保证可用性。
    ConfigModule,
    ConfigRuntimeModule,
    LoggerModule,
    IdentityModule,
    QueueModule.registerQueues([QUEUE_NAMES.SSO_SYNC]),
  ],
  providers: [
    SsoProviderService,
    ProviderProfileNormalizerService,
    SsoAuthorizeService,
    SsoCallbackService,
    SsoStateService,
    SsoLoginCodeService,
  ],
  exports: [
    SsoProviderService,
    SsoAuthorizeService,
    SsoCallbackService,
    SsoStateService,
    SsoLoginCodeService,
    ProviderProfileNormalizerService,
  ],
})
export class SsoModule {}
