import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyResult } from 'jose';
import { LoggerService } from '@core/logger';
import { BaseSsoProvider } from './base.provider';
import type {
  BuildOidcAuthorizeUrlInput,
  ExchangeCodeForTokensInput,
  SsoTokenSet,
  VerifiedIdTokenClaims,
  VerifyIdTokenInput,
} from '../types/sso-provider.port';

/** id_token 签名允许的算法（拒绝 alg=none / 对称算法）。 */
const ALLOWED_ALGORITHMS = [
  'RS256',
  'RS384',
  'RS512',
  'ES256',
  'ES384',
  'ES512',
  'PS256',
  'PS384',
  'PS512',
];

/**
 * OIDC provider 的通用配置（由子类/registry 构造时注入）。
 */
export interface OidcProviderConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  /** 是否启用 PKCE（S256）。 */
  usePkce?: boolean;
}

/**
 * 通用 OpenID Connect provider。
 *
 * 端点由 issuer 推导（可被子类覆盖的 protected getter）：
 * - authorize: `${issuer}/authorize`
 * - token:     `${issuer}/token`
 * - userinfo:  `${issuer}/userinfo`
 * - jwks:      `${issuer}/.well-known/jwks.json`
 *
 * 在通用 OAuth2 之上提供严谨的 OIDC 能力：nonce、PKCE
 * （{@link generateCodeVerifier} / {@link generateCodeChallenge}）、
 * id_token 的 JWKS 验签（{@link verifyIdToken}，校验 issuer/audience/算法/nonce/iat）。
 *
 * 同时实现端口的 {@link buildAuthorizeUrl}（不含 nonce/PKCE，向后兼容），并新增
 * {@link buildOidcAuthorizationUrl}（含 nonce/PKCE）。
 */
export class OidcSsoProvider extends BaseSsoProvider {
  readonly name: string = 'oidc';

  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(
    protected readonly config: OidcProviderConfig,
    logger: LoggerService,
  ) {
    super(logger);
    this.logger.setContext(this.constructor.name);
  }

  // ─── 端点（可被子类覆盖）──────────────────────────────────────────────

  protected get issuer(): string {
    return this.config.issuer;
  }

  protected get authorizeUrl(): string {
    return `${this.issuer}/authorize`;
  }

  protected get tokenUrl(): string {
    return `${this.issuer}/token`;
  }

  protected get userinfoUrl(): string {
    return `${this.issuer}/userinfo`;
  }

  protected get jwksUri(): string {
    return `${this.issuer}/.well-known/jwks.json`;
  }

  /** scope 自动确保包含 openid。 */
  protected resolveScope(): string {
    const scopes = (this.config.scope ?? '').split(/\s+/).filter(Boolean);
    if (!scopes.includes('openid')) {
      scopes.unshift('openid');
    }
    return scopes.join(' ');
  }

  // ─── Port 兼容方法 ────────────────────────────────────────────────────

  buildAuthorizeUrl(state: string, redirectUri?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: redirectUri ?? this.config.redirectUri,
      scope: this.resolveScope(),
      state,
    });
    return `${this.authorizeUrl}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri?: string): Promise<SsoTokenSet> {
    return this.exchangeCodeForTokens({ code, redirectUri });
  }

  async fetchUserInfo(tokenSet: SsoTokenSet): Promise<Record<string, unknown>> {
    const data = await this.httpGet<Record<string, unknown>>(this.userinfoUrl, {
      Authorization: `Bearer ${tokenSet.accessToken}`,
    });
    return data ?? {};
  }

  // ─── OIDC 扩展能力 ────────────────────────────────────────────────────

  /** 构建含 nonce / 可选 PKCE 的授权 URL（用户端 OIDC 登录）。 */
  buildOidcAuthorizationUrl(input: BuildOidcAuthorizeUrlInput): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: input.redirectUri ?? this.config.redirectUri,
      scope: this.resolveScope(),
      state: input.state,
      nonce: input.nonce,
    });
    if (input.codeChallenge) {
      params.set('code_challenge', input.codeChallenge);
      params.set('code_challenge_method', 'S256');
    }
    return `${this.authorizeUrl}?${params.toString()}`;
  }

  /** 授权码换取 token（支持 PKCE code_verifier）。 */
  async exchangeCodeForTokens(
    input: ExchangeCodeForTokensInput,
  ): Promise<SsoTokenSet> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri ?? this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });
    if (input.codeVerifier) {
      body.set('code_verifier', input.codeVerifier);
    }
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

  /**
   * 通过 IdP 的 JWKS 校验 id_token 签名与关键声明。
   *
   * 校验：issuer、audience（=clientId）、允许算法（RS/ES/PS）、nonce 匹配、
   * iat 不在未来（容忍 300s 时钟偏移），返回已校验 claims。
   */
  async verifyIdToken(
    input: VerifyIdTokenInput,
  ): Promise<VerifiedIdTokenClaims> {
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(new URL(this.jwksUri));
    }

    let result: JWTVerifyResult;
    try {
      result = await jwtVerify(input.idToken, this.jwks, {
        issuer: this.issuer,
        audience: this.config.clientId,
        algorithms: ALLOWED_ALGORITHMS,
      });
    } catch (err) {
      const msg = (err as Error).message || 'unknown';
      this.logger.warn('id_token verification failed', { reason: msg });
      throw new Error(`id_token verification failed: ${msg}`);
    }

    const claims = result.payload as unknown as VerifiedIdTokenClaims;
    if (!claims.sub) {
      throw new Error('id_token missing required claim: sub');
    }
    if (claims.nonce !== input.nonce) {
      this.logger.warn('id_token nonce mismatch');
      throw new Error('id_token nonce mismatch');
    }
    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.iat === 'number' && claims.iat > now + 300) {
      throw new Error('id_token iat is in the future');
    }
    return claims;
  }

  // ─── PKCE 工具 ────────────────────────────────────────────────────────

  /** 生成 PKCE code_verifier（base64url）。 */
  generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
  }

  /** 由 verifier 派生 S256 code_challenge（base64url）。 */
  generateCodeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
  }

  /** 是否启用 PKCE。 */
  get isPkceEnabled(): boolean {
    return this.config.usePkce === true;
  }
}
