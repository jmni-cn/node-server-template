import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { BusinessException } from '@core/common';
import { LoggerService } from '@core/logger';
import { appConfig, ssoConfig } from '@core/config';
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
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(SsoProviderService.name);
  }

  onModuleInit(): void {
    // 通用 OIDC：需要 issuer + clientId。
    if (this.cfg.clientId && this.cfg.issuer) {
      this.assertSecureCallback('oidc', this.cfg.redirectUri);
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
      this.assertSecureCallback('microsoft', this.cfg.microsoft.redirectUri);
      this.register(new MicrosoftSsoProvider(this.cfg.microsoft, this.logger));
    }

    // KRAFTON（示例 provider）：需要 clientId + oidcHost。
    if (this.cfg.krafton.clientId && this.cfg.krafton.oidcHost) {
      this.assertSecureCallback('krafton', this.cfg.krafton.redirectUri);
      this.register(new KraftonSsoProvider(this.cfg.krafton, this.logger));
    }

    this.logger.log('SSO providers registered', {
      providers: this.list(),
    });
  }

  /**
   * 生产环境强制 provider 回调地址为 https（防回调阶段在 production 经明文 http
   * 传输授权码 / token）。
   *
   * 校验放在启动期（onModuleInit）而非每次请求：
   * - callbackUrl 全部来自服务端配置、与请求无关，启动期一次校验即可覆盖；
   * - 配置错误在 production 启动时即「fail fast」暴露，零运行时开销，
   *   且能在任何授权 / 回调发生前拦截；
   * - 非 production（development / test）允许 http，便于本地联调。
   *
   * 空 redirectUri 不在此处校验（由各 provider 注册条件与 config schema 兜底）。
   */
  private assertSecureCallback(provider: string, redirectUri: string): void {
    const isProd = this.app.nodeEnv === 'production';
    if (!isProd || !redirectUri) {
      return;
    }
    if (!/^https:\/\//i.test(redirectUri)) {
      this.logger.error('SSO callback must use https in production', {
        provider,
        redirectUri,
      });
      throw new Error(
        `SSO provider "${provider}" callbackUrl must use https in production (got: ${redirectUri})`,
      );
    }
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
