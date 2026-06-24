/**
 * 内置 SSO provider 标识。
 */
export const SSO_PROVIDERS = {
  OIDC: 'oidc',
  MICROSOFT: 'microsoft',
  /** 示例 provider，仅在配置 SSO_KRAFTON_* 时启用。 */
  KRAFTON: 'krafton',
} as const;

/** 一次性登录码缓存命名空间。 */
export const SSO_LOGIN_CODE_NAMESPACE = 'sso:logincode';

export type SsoProviderName =
  (typeof SSO_PROVIDERS)[keyof typeof SSO_PROVIDERS];

/** 外部 HTTP 请求默认超时（ms）。 */
export const SSO_HTTP_TIMEOUT_MS = 15000;
