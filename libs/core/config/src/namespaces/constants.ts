/**
 * 配置常量定义。
 *
 * 分为两类：
 * 1. *_DEFAULTS - 默认值，可被环境变量覆盖
 * 2. *_CONSTANTS - 常量值，不可被环境变量覆盖（硬编码）
 */

// ============================================================================
// 应用配置
// ============================================================================

/** 应用配置 - 可被环境变量覆盖的默认值 */
export const APP_DEFAULTS = {
  /** 默认端口 (env: APP_PORT) */
  PORT: 3000,
  /** 默认运行环境 (env: NODE_ENV) */
  NODE_ENV: 'production',
  /** 应用名称 (env: APP_NAME) */
  NAME: 'app',
  /** API 路由前缀 (env: API_PREFIX) */
  API_PREFIX: 'v1',
} as const;

/** 应用配置 - 常量值（不可被环境变量覆盖） */
export const APP_CONSTANTS = {
  /** CORS 默认开启 */
  CORS_ENABLED: true,
  /**
   * CORS 默认允许的来源列表。
   * 禁止使用 '*'：与 credentials: true 共存时浏览器会拒绝响应（CORS 规范限制）。
   * 通过环境变量 CORS_ORIGIN 传入逗号分隔的域名列表可覆盖。
   */
  CORS_ORIGINS: ['http://localhost:3000'],
} as const;

// ============================================================================
// 数据库配置
// ============================================================================

/** 数据库配置 - 可被环境变量覆盖的默认值 */
export const DATABASE_DEFAULTS = {
  /** 默认主机 (env: DB_HOST) */
  HOST: 'mysql',
  /** 默认端口 (env: DB_PORT) */
  PORT: 3306,
  /** 默认用户名 (env: DB_USERNAME) */
  USERNAME: 'root',
  /** 默认密码 (env: DB_PASSWORD) */
  PASSWORD: '',
  /** 默认数据库名 (env: DB_DATABASE) */
  DATABASE: 'app',
  /** 连接池最大连接数 (env: DB_CONNECTION_LIMIT) */
  CONNECTION_LIMIT: 20,
} as const;

/** 数据库配置 - 常量值（不可被环境变量覆盖） */
export const DATABASE_CONSTANTS = {
  /** 数据库类型 */
  TYPE: 'mysql' as const,
  /** 默认关闭 SQL 日志 */
  LOGGING: false,
  /** 字符集 */
  CHARSET: 'utf8mb4',
  /** 校对集 */
  COLLATION: 'utf8mb4_0900_ai_ci',
  /** MySQL session timezone — 所有 DATETIME 列存储 UTC 时刻 */
  TIMEZONE: '+00:00',
} as const;

// ============================================================================
// Redis 配置
// ============================================================================

/** Redis 配置 - 可被环境变量覆盖的默认值 */
export const REDIS_DEFAULTS = {
  /** 默认主机 (env: REDIS_HOST) */
  HOST: 'redis',
  /** 默认端口 (env: REDIS_PORT) */
  PORT: 6379,
  /** 默认数据库索引 (env: REDIS_DB) */
  DB: 0,
} as const;

// ============================================================================
// JWT 配置
// ============================================================================

/** JWT 配置 - 可被环境变量覆盖的默认值 */
export const JWT_DEFAULTS = {
  /** Access Token 过期时间 (env: JWT_ACCESS_EXPIRES_IN) */
  ACCESS_EXPIRES_IN: '15m',
  /** Refresh Token 过期时间 (env: JWT_REFRESH_EXPIRES_IN) */
  REFRESH_EXPIRES_IN: '7d',
  /** 记住登录时 Access Token 过期时间 (env: JWT_REMEMBER_ACCESS_EXPIRES_IN) */
  REMEMBER_ACCESS_EXPIRES_IN: '1d',
  /** 记住登录时 Refresh Token 过期时间 (env: JWT_REMEMBER_REFRESH_EXPIRES_IN) */
  REMEMBER_REFRESH_EXPIRES_IN: '30d',
} as const;

// ============================================================================
// SSO (OIDC) 配置
// ============================================================================

/** SSO 配置 - 可被环境变量覆盖的默认值 */
export const SSO_DEFAULTS = {
  /** OIDC scope (env: SSO_SCOPE) */
  SCOPE: 'openid profile email',
  /** 登录回调地址 (env: SSO_REDIRECT_URI) */
  REDIRECT_URI: 'http://localhost:3000/sso/callback',
} as const;

// ============================================================================
// 队列配置 (BullMQ)
// ============================================================================

/** 队列配置 - 可被环境变量覆盖的默认值 */
export const QUEUE_DEFAULTS = {
  /** worker 并发度 (env: QUEUE_CONCURRENCY) */
  CONCURRENCY: 5,
} as const;

// ============================================================================
// 日志配置
// ============================================================================

/** 日志配置 - 可被环境变量覆盖的默认值 */
export const LOGGER_DEFAULTS = {
  /** 默认日志级别 (env: LOG_LEVEL) */
  LEVEL: 'info',
  /** 默认不美化输出 (env: LOG_PRETTY_PRINT) */
  PRETTY_PRINT: false,
  /** 默认不启用文件日志 (env: LOG_FILE_ENABLED) */
  FILE_ENABLED: false,
  /** 默认日志目录 (env: LOG_DIR) */
  DIR: './logs',
  /** 应用日志文件名 (env: LOG_APP_FILE) */
  APP_LOG_FILE: 'app.log',
  /** 错误日志文件名 (env: LOG_ERROR_FILE) */
  ERROR_LOG_FILE: 'error.log',
} as const;

/** 日志配置 - 常量值（不可被环境变量覆盖） */
export const LOGGER_CONSTANTS = {
  /** 日志文件保留数量 */
  MAX_FILES: 1000,
  /** 单个日志文件最大大小 */
  MAX_SIZE: '10m',
  /** 是否包含时间戳 */
  INCLUDE_TIMESTAMP: true,
  /** 是否包含进程 ID */
  INCLUDE_PID: false,
  /** 是否包含主机名 */
  INCLUDE_HOSTNAME: false,
} as const;

// ============================================================================
// 国际化配置
// ============================================================================

/** 国际化配置 - 常量值（不可被环境变量覆盖） */
export const I18N_CONSTANTS = {
  /** 默认语言 */
  DEFAULT_LANGUAGE: 'zh-CN',
  /** 回退语言 */
  FALLBACK_LANGUAGE: 'en',
} as const;
