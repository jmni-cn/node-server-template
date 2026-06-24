import { LoggerService } from '@core/logger';
import type { SsoMicrosoftConfigType } from '@core/config';
import { BaseSsoProvider } from './base.provider';
import type { SsoTokenSet } from '../types/sso-provider.port';

/** Microsoft Graph `/me` 响应（仅取归一化所需字段）。 */
interface MicrosoftUserResponse {
  id: string;
  displayName?: string;
  userPrincipalName?: string;
  mail?: string;
  givenName?: string;
  surname?: string;
  [key: string]: unknown;
}

/**
 * Microsoft Entra（Azure AD）v2.0 provider。
 *
 * 文档：https://learn.microsoft.com/azure/active-directory/develop/v2-oauth2-auth-code-flow
 * - authorize: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize`
 * - token:     `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
 * - userinfo:  `https://graph.microsoft.com/v1.0/me`
 *
 * 端口兼容（buildAuthorizeUrl / exchangeCode / fetchUserInfo）。
 */
export class MicrosoftSsoProvider extends BaseSsoProvider {
  readonly name = 'microsoft';

  constructor(
    private readonly config: SsoMicrosoftConfigType,
    logger: LoggerService,
  ) {
    super(logger);
    this.logger.setContext(MicrosoftSsoProvider.name);
  }

  private get tenantId(): string {
    return this.config.tenantId || 'common';
  }

  private get authorizeUrl(): string {
    return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize`;
  }

  private get tokenUrl(): string {
    return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
  }

  buildAuthorizeUrl(state: string, redirectUri?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: redirectUri ?? this.config.redirectUri,
      response_mode: 'query',
      scope: this.config.scope,
      state,
    });
    return `${this.authorizeUrl}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri?: string): Promise<SsoTokenSet> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      redirect_uri: redirectUri ?? this.config.redirectUri,
      grant_type: 'authorization_code',
    });
    const data = await this.httpPost<Record<string, unknown>>(
      this.tokenUrl,
      body,
    );
    return {
      accessToken: String(data.access_token ?? ''),
      tokenType: data.token_type as string | undefined,
      expiresIn: data.expires_in as number | undefined,
      refreshToken: data.refresh_token as string | undefined,
      idToken: data.id_token as string | undefined,
      scope: data.scope as string | undefined,
    };
  }

  async fetchUserInfo(tokenSet: SsoTokenSet): Promise<Record<string, unknown>> {
    const userInfo = await this.httpGet<MicrosoftUserResponse>(
      'https://graph.microsoft.com/v1.0/me',
      { Authorization: `Bearer ${tokenSet.accessToken}` },
    );
    // 归一化为通用键，便于 ProviderProfileNormalizerService 处理。
    return {
      ...userInfo,
      sub: userInfo.id,
      email: userInfo.mail ?? userInfo.userPrincipalName,
      name: userInfo.displayName,
    };
  }
}
