import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';
import { JWT_DEFAULTS } from './constants';

/**
 * JWT 配置命名空间（access + refresh）。
 */
export const jwtConfig = registerAs('jwt', () => ({
  /**
   * Access Token 密钥（必须通过环境变量配置）。
   * 不提供 `|| ''` 兜底：缺失时由 config 校验 schema（required + min 32）在启动期拦截，
   * 避免以空密钥静默签发可被伪造的令牌。
   */
  accessSecret: process.env.JWT_ACCESS_SECRET as string,
  /** Refresh Token 密钥（必须通过环境变量配置；同上由 schema 强校验）。 */
  refreshSecret: process.env.JWT_REFRESH_SECRET as string,
  /**
   * 是否允许从 `Authorization: Bearer` 头提取 Refresh Token（默认关闭）。
   * 默认仅从 HttpOnly Cookie 提取，降低 XSS 下令牌被读取的风险；
   * 仅在需要支持纯 API / 移动端等无 Cookie 场景时显式开启。
   */
  refreshFromAuthHeader: process.env.JWT_REFRESH_FROM_AUTH_HEADER === 'true',
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
  /**
   * 单主体（subjectType + userId）允许的最大活跃会话数（未撤销且未过期）。
   * 登录创建新会话后，若活跃会话超过该上限，按 createdAt 升序驱逐最旧会话，
   * 仅保留最近的 N 个。<= 0 表示不限制。
   */
  maxActiveSessions: parseInt(
    process.env.JWT_MAX_ACTIVE_SESSIONS ??
      String(JWT_DEFAULTS.MAX_ACTIVE_SESSIONS),
    10,
  ),
  /**
   * 会话策略（默认 'replace'）。
   * - 'replace'：登录即作废该主体其它所有活跃会话（全局单会话），maxActiveSessions 忽略。
   * - 'limit'：保留最近 maxActiveSessions 个，超出按最旧驱逐。
   * refresh token 轮换不属于登录，不触发该策略。
   */
  policy: (process.env.SESSION_POLICY ?? JWT_DEFAULTS.SESSION_POLICY) as
    | 'replace'
    | 'limit',
}));

/**
 * JWT 配置接口。
 */
export interface JwtConfigType {
  accessSecret: string;
  refreshSecret: string;
  refreshFromAuthHeader: boolean;
  accessExpiresIn: string;
  refreshExpiresIn: string;
  rememberAccessExpiresIn: string;
  rememberRefreshExpiresIn: string;
  cookieSecure: boolean;
  cookieSameSite: 'lax' | 'strict' | 'none';
  cookieDomain?: string;
  maxActiveSessions: number;
  policy: 'replace' | 'limit';
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
  JWT_REFRESH_FROM_AUTH_HEADER: Joi.boolean()
    .default(false)
    .description(
      '是否允许从 Authorization 头提取 Refresh Token（默认关闭，仅用 Cookie）',
    ),
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
  JWT_MAX_ACTIVE_SESSIONS: Joi.number()
    .integer()
    .default(JWT_DEFAULTS.MAX_ACTIVE_SESSIONS)
    .description('单主体最大活跃会话数（<= 0 不限制，超限驱逐最旧会话；仅 limit 策略生效）'),
  SESSION_POLICY: Joi.string()
    .valid('replace', 'limit')
    .default(JWT_DEFAULTS.SESSION_POLICY)
    .description('会话策略：replace=全局单会话（默认）；limit=保留最近 N 个'),
};
