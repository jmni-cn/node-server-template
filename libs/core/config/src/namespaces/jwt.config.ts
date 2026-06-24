import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';
import { JWT_DEFAULTS } from './constants';

/**
 * JWT 配置命名空间（access + refresh）。
 */
export const jwtConfig = registerAs('jwt', () => ({
  /** Access Token 密钥（必须通过环境变量配置） */
  accessSecret: process.env.JWT_ACCESS_SECRET || '',
  /** Refresh Token 密钥（必须通过环境变量配置） */
  refreshSecret: process.env.JWT_REFRESH_SECRET || '',
  /** Access Token 过期时间 */
  accessExpiresIn:
    process.env.JWT_ACCESS_EXPIRES_IN ?? JWT_DEFAULTS.ACCESS_EXPIRES_IN,
  /** Refresh Token 过期时间 */
  refreshExpiresIn:
    process.env.JWT_REFRESH_EXPIRES_IN ?? JWT_DEFAULTS.REFRESH_EXPIRES_IN,
  /** 「记住我」场景的 Access Token 过期时间（默认与普通 access 一致，回退 '30m'） */
  rememberAccessExpiresIn:
    process.env.JWT_REMEMBER_ACCESS_EXPIRES_IN ??
    process.env.JWT_ACCESS_EXPIRES_IN ??
    '30m',
  /** 「记住我」场景的 Refresh Token 过期时间（默认 '30d'） */
  rememberRefreshExpiresIn:
    process.env.JWT_REMEMBER_REFRESH_EXPIRES_IN ?? '30d',
  /** Refresh Cookie 是否仅 HTTPS（默认 false） */
  cookieSecure: process.env.JWT_COOKIE_SECURE === 'true',
  /** Refresh Cookie SameSite 策略（默认 'lax'） */
  cookieSameSite: (process.env.JWT_COOKIE_SAME_SITE ?? 'lax') as
    | 'lax'
    | 'strict'
    | 'none',
  /** Refresh Cookie 作用域（可选，跨子域时配置） */
  cookieDomain: process.env.JWT_COOKIE_DOMAIN || undefined,
}));

/**
 * JWT 配置接口。
 */
export interface JwtConfigType {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
  rememberAccessExpiresIn: string;
  rememberRefreshExpiresIn: string;
  cookieSecure: boolean;
  cookieSameSite: 'lax' | 'strict' | 'none';
  cookieDomain?: string;
}

/**
 * JWT 配置验证 Schema。
 */
export const jwtConfigSchema = {
  JWT_ACCESS_SECRET: Joi.string()
    .min(32)
    .required()
    .description('JWT Access Token 密钥（必须配置，至少 32 字符）'),
  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .required()
    .description('JWT Refresh Token 密钥（必须配置，至少 32 字符）'),
  JWT_ACCESS_EXPIRES_IN: Joi.string()
    .default(JWT_DEFAULTS.ACCESS_EXPIRES_IN)
    .description('Access Token 过期时间'),
  JWT_REFRESH_EXPIRES_IN: Joi.string()
    .default(JWT_DEFAULTS.REFRESH_EXPIRES_IN)
    .description('Refresh Token 过期时间'),
  JWT_REMEMBER_ACCESS_EXPIRES_IN: Joi.string()
    .optional()
    .description('「记住我」Access Token 过期时间（默认同 access，回退 30m）'),
  JWT_REMEMBER_REFRESH_EXPIRES_IN: Joi.string()
    .default('30d')
    .description('「记住我」Refresh Token 过期时间'),
  JWT_COOKIE_SECURE: Joi.boolean()
    .default(false)
    .description('Refresh Cookie 是否仅 HTTPS'),
  JWT_COOKIE_SAME_SITE: Joi.string()
    .valid('lax', 'strict', 'none')
    .default('lax')
    .description('Refresh Cookie SameSite 策略'),
  JWT_COOKIE_DOMAIN: Joi.string()
    .optional()
    .description('Refresh Cookie 作用域（跨子域时配置）'),
};
