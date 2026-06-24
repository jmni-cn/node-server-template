/**
 * @integrations/sso — provider 类层级 barrel。
 *
 * BaseSsoProvider → OidcSsoProvider → KraftonSsoProvider（示例）；
 * MicrosoftSsoProvider 直接继承 Base。
 */
export * from './base.provider';
export * from './oidc.provider';
export * from './microsoft.provider';
export * from './krafton.provider';
