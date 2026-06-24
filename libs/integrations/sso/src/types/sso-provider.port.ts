/**
 * 归一化后的第三方用户资料。
 */
export interface NormalizedProfile {
  /** provider 标识（如 'oauth' / 'oidc'）。 */
  provider: string;
  /** 第三方侧用户唯一标识（OIDC sub / OAuth id）。 */
  providerUserId: string;
  /** 邮箱（可能缺省）。 */
  email: string | null;
  /** 昵称（provider 侧展示昵称：初始化主体 nickname，并落 ExternalIdentity.providerNickname 快照）。 */
  nickname: string | null;
  /** 用户名候选（preferred_username / username / email 本地部分）。 */
  username: string | null;
  /** 头像 URL。 */
  avatar: string | null;
  /** 原始 userinfo（用于落库 raw / 调试）。 */
  raw: Record<string, unknown>;
}

/**
 * Token 交换结果（OAuth2 token endpoint 响应归一化）。
 */
export interface SsoTokenSet {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
  refreshToken?: string;
  idToken?: string;
  scope?: string;
}

/**
 * SSO Provider 适配器端口（六边形端口）。
 *
 * 每个第三方 IdP 适配器实现该接口；上层 registry / service 仅依赖该端口。
 */
export interface SsoProviderPort {
  /** provider 标识。 */
  readonly name: string;
  /** 构造授权跳转 URL（state 由上层生成并持久化校验）。 */
  buildAuthorizeUrl(state: string, redirectUri?: string): string;
  /** 用授权码换取 token。 */
  exchangeCode(code: string, redirectUri?: string): Promise<SsoTokenSet>;
  /** 拉取第三方原始用户信息。 */
  fetchUserInfo(tokenSet: SsoTokenSet): Promise<Record<string, unknown>>;
}

/**
 * 构建 OIDC 授权 URL 的入参（含 nonce / PKCE）。
 */
export interface BuildOidcAuthorizeUrlInput {
  state: string;
  nonce: string;
  codeChallenge?: string;
  redirectUri?: string;
}

/**
 * OIDC 授权码换取 token 的入参（含可选 PKCE code_verifier）。
 */
export interface ExchangeCodeForTokensInput {
  code: string;
  redirectUri?: string;
  codeVerifier?: string;
}

/**
 * 校验 id_token 的入参。
 */
export interface VerifyIdTokenInput {
  idToken: string;
  nonce: string;
}

/**
 * 已校验的 id_token claims（最小集）。
 */
export interface VerifiedIdTokenClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
  [key: string]: unknown;
}

/**
 * 一次性登录码（one-time code）载荷：SSO 回调成功后写入 Redis（单次使用，短 TTL），
 * 前端凭 code 调 `POST /sso/exchange` 换取 access token + Refresh Token Cookie。
 *
 * Token 永不出现在回调重定向 URL 中（仅 code）。
 */
export interface SsoLoginCodePayload {
  accessToken: string;
  refreshToken: string;
  /** Refresh Token 过期时刻（ISO 字符串）。 */
  refreshExpiresAt: string;
  userUid: string;
}
