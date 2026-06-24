import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { BusinessException } from '@core/common';
import { LoggerService } from '@core/logger';
import { ssoConfig } from '@core/config';
import {
  OidcSsoProvider,
  MicrosoftSsoProvider,
  KraftonSsoProvider,
} from '../providers';
import { SSO_PROVIDERS } from '../constants';
import { SsoErrorCode } from '../constants';
import type { SsoProviderPort } from '../types/sso-provider.port';

/**
 * SSO provider 注册表。
 *
 * 在模块初始化时按各 provider 的配置块构造实例并以 `.name` 为键注册：
 * - `oidc`      — 通用 OIDC，配置 SSO_ISSUER + SSO_CLIENT_ID；
 * - `microsoft` — Microsoft Entra v2.0，配置 SSO_MICROSOFT_CLIENT_ID；
 * - `krafton`   — 示例 OIDC provider，配置 SSO_KRAFTON_CLIENT_ID（可选，缺省不注册）。
 *
 * 未配置（clientId 为空）的 provider 不入册；`resolve(name)` 对未知或未配置的
 * provider 抛 `SSO_PROVIDER_NOT_SUPPORTED`。返回类型保持 {@link SsoProviderPort}，
 * 上层 authorize/callback 服务无感知。
 */
@Injectable()
export class SsoProviderService implements OnModuleInit {
  private readonly registry = new Map<string, SsoProviderPort>();

  constructor(
    @Inject(ssoConfig.KEY)
    private readonly cfg: ConfigType<typeof ssoConfig>,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(SsoProviderService.name);
  }

  onModuleInit(): void {
    // 通用 OIDC：需要 issuer + clientId。
    if (this.cfg.clientId && this.cfg.issuer) {
      this.register(
        new OidcSsoProvider(
          {
            issuer: this.cfg.issuer,
            clientId: this.cfg.clientId,
            clientSecret: this.cfg.clientSecret,
            redirectUri: this.cfg.redirectUri,
            scope: this.cfg.scope,
          },
          this.logger,
        ),
      );
    }

    // Microsoft Entra：需要 clientId。
    if (this.cfg.microsoft.clientId) {
      this.register(new MicrosoftSsoProvider(this.cfg.microsoft, this.logger));
    }

    // KRAFTON（示例 provider）：需要 clientId + oidcHost。
    if (this.cfg.krafton.clientId && this.cfg.krafton.oidcHost) {
      this.register(new KraftonSsoProvider(this.cfg.krafton, this.logger));
    }

    this.logger.log('SSO providers registered', {
      providers: this.list(),
    });
  }

  private register(provider: SsoProviderPort): void {
    this.registry.set(provider.name, provider);
  }

  /**
   * 解析 provider，未知或未配置时抛 `SSO_PROVIDER_NOT_SUPPORTED`。
   */
  resolve(provider: string): SsoProviderPort {
    const instance = this.registry.get(provider);
    if (!instance) {
      throw new BusinessException(SsoErrorCode.SSO_PROVIDER_NOT_SUPPORTED, {
        provider,
      });
    }
    return instance;
  }

  /** 已注册的 provider 标识列表。 */
  list(): string[] {
    return [...this.registry.keys()];
  }

  /** 内置 provider 标识常量（便于路由/文档引用）。 */
  static readonly KNOWN_PROVIDERS = SSO_PROVIDERS;
}
