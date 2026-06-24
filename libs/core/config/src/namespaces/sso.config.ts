import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';
import { SSO_DEFAULTS } from './constants';

/**
 * SSO 配置命名空间。
 *
 * 包含三部分：
 * 1. 通用单 IdP OpenID Connect 配置（issuer / clientId / clientSecret / redirectUri / scope）——
 *    用于内置 `oidc` provider；
 * 2. 可选 provider 配置块（microsoft / krafton）——仅当对应 *_CLIENT_ID 配置时生效；
 * 3. 一次性登录码（one-time code）与登录后重定向（postLoginRedirect）配置。
 *
 * 所有新增字段均为可选（allow('') / 带默认值），未配置时不影响模板运行。
 */
export const ssoConfig = registerAs('sso', () => ({
  /** OIDC Issuer（discovery 根，如 https://idp.example.com） */
  issuer: process.env.SSO_ISSUER ?? '',
  /** OAuth2 Client ID */
  clientId: process.env.SSO_CLIENT_ID ?? '',
  /** OAuth2 Client Secret */
  clientSecret: process.env.SSO_CLIENT_SECRET ?? '',
  /** 登录回调地址 */
  redirectUri: process.env.SSO_REDIRECT_URI ?? SSO_DEFAULTS.REDIRECT_URI,
  /** 请求的 scope（空格分隔） */
  scope: process.env.SSO_SCOPE ?? SSO_DEFAULTS.SCOPE,

  /**
   * Microsoft Entra（Azure AD）v2.0 provider 配置块。
   * 仅当 SSO_MICROSOFT_CLIENT_ID 非空时被注册。
   */
  microsoft: {
    /** 租户 ID（'common' / 'organizations' / 具体租户 GUID） */
    tenantId: process.env.SSO_MICROSOFT_TENANT_ID || 'common',
    clientId: process.env.SSO_MICROSOFT_CLIENT_ID ?? '',
    clientSecret: process.env.SSO_MICROSOFT_CLIENT_SECRET ?? '',
    redirectUri: process.env.SSO_MICROSOFT_REDIRECT_URI ?? '',
    scope: process.env.SSO_MICROSOFT_SCOPE ?? 'openid profile email User.Read',
  },

  /**
   * KRAFTON OIDC provider 配置块（示例 provider）。
   * 仅当 SSO_KRAFTON_CLIENT_ID 非空时被注册；未配置时安全忽略。
   */
  krafton: {
    /** OIDC Host（所有端点由此推导，如 https://accounts.example.com） */
    oidcHost: process.env.SSO_KRAFTON_OIDC_HOST ?? '',
    clientId: process.env.SSO_KRAFTON_CLIENT_ID ?? '',
    clientSecret: process.env.SSO_KRAFTON_CLIENT_SECRET ?? '',
    redirectUri: process.env.SSO_KRAFTON_REDIRECT_URI ?? '',
    scope: process.env.SSO_KRAFTON_SCOPE ?? 'openid',
    /** 是否启用 PKCE（S256） */
    usePkce: process.env.SSO_KRAFTON_USE_PKCE === 'true',
  },

  /**
   * 登录成功后的前端重定向地址。配置时回调将 302 跳转到
   * `${postLoginRedirect}?code=<oneTimeCode>`；为空时回调直接返回 `{ code }`。
   */
  postLoginRedirect: process.env.SSO_POST_LOGIN_REDIRECT ?? '',

  /** 一次性登录码 TTL（秒），默认 60。 */
  loginCodeTtl: Number(process.env.SSO_LOGIN_CODE_TTL ?? 60),
}));

/**
 * Microsoft provider 配置接口。
 */
export interface SsoMicrosoftConfigType {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
}

/**
 * KRAFTON provider 配置接口。
 */
export interface SsoKraftonConfigType {
  oidcHost: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  usePkce: boolean;
}

/**
 * SSO 配置接口。
 */
export interface SsoConfigType {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  microsoft: SsoMicrosoftConfigType;
  krafton: SsoKraftonConfigType;
  postLoginRedirect: string;
  loginCodeTtl: number;
}

/**
 * SSO 配置验证 Schema。新增字段全部可选，未配置不影响启动。
 */
export const ssoConfigSchema = {
  SSO_ISSUER: Joi.string()
    .allow('')
    .default('')
    .description('OIDC Issuer (discovery 根 URL)'),
  SSO_CLIENT_ID: Joi.string()
    .allow('')
    .default('')
    .description('OAuth2 Client ID'),
  SSO_CLIENT_SECRET: Joi.string()
    .allow('')
    .default('')
    .description('OAuth2 Client Secret'),
  SSO_REDIRECT_URI: Joi.string()
    .uri()
    .default(SSO_DEFAULTS.REDIRECT_URI)
    .description('SSO 登录回调地址'),
  SSO_SCOPE: Joi.string()
    .default(SSO_DEFAULTS.SCOPE)
    .description('OIDC scope（空格分隔）'),

  // ---- Microsoft Entra v2.0 ----
  SSO_MICROSOFT_TENANT_ID: Joi.string()
    .allow('')
    .default('common')
    .description('Microsoft 租户 ID（common / organizations / GUID）'),
  SSO_MICROSOFT_CLIENT_ID: Joi.string().allow('').default(''),
  SSO_MICROSOFT_CLIENT_SECRET: Joi.string().allow('').default(''),
  SSO_MICROSOFT_REDIRECT_URI: Joi.string().uri().allow('').default(''),
  SSO_MICROSOFT_SCOPE: Joi.string()
    .allow('')
    .default('openid profile email User.Read'),

  // ---- KRAFTON OIDC（示例 provider）----
  SSO_KRAFTON_OIDC_HOST: Joi.string().uri().allow('').default(''),
  SSO_KRAFTON_CLIENT_ID: Joi.string().allow('').default(''),
  SSO_KRAFTON_CLIENT_SECRET: Joi.string().allow('').default(''),
  SSO_KRAFTON_REDIRECT_URI: Joi.string().uri().allow('').default(''),
  SSO_KRAFTON_SCOPE: Joi.string().allow('').default('openid'),
  SSO_KRAFTON_USE_PKCE: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),

  // ---- 一次性登录码 / 登录后重定向 ----
  SSO_POST_LOGIN_REDIRECT: Joi.string().uri().allow('').default(''),
  SSO_LOGIN_CODE_TTL: Joi.number().integer().min(1).default(60),
};
