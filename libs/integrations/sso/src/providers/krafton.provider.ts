/**
 * Example provider — a custom OIDC IdP. Safe to delete if unused; not wired by
 * default unless KRAFTON_* (SSO_KRAFTON_*) env configured.
 *
 * 演示如何在 {@link OidcSsoProvider} 之上派生一个自定义 OIDC IdP：仅覆盖端点推导
 * （从单一 oidcHost 推导 auth/token/me/jwks）。归一化交给通用
 * ProviderProfileNormalizerService，不在此承载任何业务字段。
 */
import { LoggerService } from '@core/logger';
import type { SsoKraftonConfigType } from '@core/config';
import { OidcSsoProvider } from './oidc.provider';
import type { SsoTokenSet } from '../types/sso-provider.port';

/**
 * KRAFTON OIDC provider（示例）。
 *
 * 端点全部从 `krafton.oidcHost` 推导：
 * - issuer:    `${oidcHost}/oidc`
 * - authorize: `${oidcHost}/oidc/auth`
 * - token:     `${oidcHost}/oidc/token`
 * - userinfo:  `${oidcHost}/oidc/me`
 * - jwks:      `${oidcHost}/oidc/jwks`
 */
export class KraftonSsoProvider extends OidcSsoProvider {
  readonly name = 'krafton';

  private readonly oidcHost: string;

  constructor(config: SsoKraftonConfigType, logger: LoggerService) {
    super(
      {
        issuer: `${config.oidcHost}/oidc`,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
        scope: config.scope,
        usePkce: config.usePkce,
      },
      logger,
    );
    this.oidcHost = config.oidcHost;
  }

  protected override get authorizeUrl(): string {
    return `${this.oidcHost}/oidc/auth`;
  }

  protected override get tokenUrl(): string {
    return `${this.oidcHost}/oidc/token`;
  }

  protected override get userinfoUrl(): string {
    return `${this.oidcHost}/oidc/me`;
  }

  protected override get jwksUri(): string {
    return `${this.oidcHost}/oidc/jwks`;
  }

  /**
   * 最小化通用 claim 归一化（sub / email / nickname / avatar），不携带任何
   * IdP 专有业务字段。其余键以原样保留在 raw 中供调试。
   */
  override async fetchUserInfo(
    tokenSet: SsoTokenSet,
  ): Promise<Record<string, unknown>> {
    const raw = await super.fetchUserInfo(tokenSet);
    return {
      ...raw,
      sub: raw.sub,
      email: raw.email,
      nickname: raw.nickname,
      avatar: raw.profile_img_url ?? raw.profile_image_url ?? raw.avatar,
    };
  }
}
