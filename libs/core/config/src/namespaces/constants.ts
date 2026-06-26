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
  /** 单主体最大活跃会话数 (env: JWT_MAX_ACTIVE_SESSIONS)，<= 0 不限制；仅当 SESSION_POLICY=limit 生效 */
  MAX_ACTIVE_SESSIONS: 1,
  /**
   * 会话策略 (env: SESSION_POLICY)。
   * - 'replace'：登录即作废该主体其它所有活跃会话（全局单会话），maxActiveSessions 忽略。
   * - 'limit'：保留最近 MAX_ACTIVE_SESSIONS 个，超出按最旧驱逐。
   */
  SESSION_POLICY: 'replace',
} as const;

// ============================================================================
// 安全 / 风控配置（登录锁定 + IP 自动封禁）
// ============================================================================

/**
 * 安全 / 风控配置 - 可被环境变量覆盖的默认值。
 *
 * 作用范围：
 * - 账户锁定（同时作用于终端用户与管理员）：连续登录失败累计达阈值后临时锁定账户。
 * - IP 风控：滑动窗口内来源 IP 登录失败累计达阈值后自动封禁该 IP 一段时间。
 *
 * 默认值与历史硬编码保持一致，仅将其提为可配置项。
 */
export const SECURITY_DEFAULTS = {
  /** 触发账户锁定的连续登录失败阈值 (env: LOGIN_MAX_FAILED) */
  MAX_FAILED_LOGIN: 5,
  /** 账户锁定时长（分钟） (env: ACCOUNT_LOCK_MINUTES) */
  ACCOUNT_LOCK_MINUTES: 15,
  /** IP 风控滑动窗口（秒） (env: SUSPICIOUS_IP_WINDOW_SECONDS) */
  SUSPICIOUS_IP_WINDOW_SECONDS: 3600,
  /** 窗口内触发自动封禁的失败阈值 (env: SUSPICIOUS_IP_THRESHOLD) */
  SUSPICIOUS_IP_THRESHOLD: 20,
  /** IP 自动封禁时长（秒） (env: IP_BAN_SECONDS) */
  IP_BAN_SECONDS: 3600,
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
// 任务可靠性兜底配置 (platform/task + worker dispatcher / stale 恢复)
// ============================================================================

/**
 * 任务可靠性兜底默认值。
 *
 * 直接投递为快路径，dispatcher（PENDING 扫描）+ stale 恢复为兜底，应对入队丢失、
 * worker 崩溃导致的任务卡死。
 *
 * TODO: 后续可在 queue.config / 独立 task.config 命名空间中暴露为环境变量。
 */
export const TASK_RELIABILITY_DEFAULTS = {
  /**
   * 投递租约宽限秒数：dispatcher 仅重投 dispatched_at 早于 now-该值的任务，
   * 避免对刚直接投递成功的任务重复投递。
   */
  DISPATCH_LEASE_GRACE_SECONDS: 60,
  /** 单次 dispatcher 扫描捞取的最大任务数 */
  DISPATCH_SCAN_LIMIT: 100,
  /**
   * stale 判定分钟数：RUNNING 且 locked_at 早于 now-该值视为卡死，
   * 应大于单个任务正常最长执行时长。
   */
  STALE_MINUTES: 15,
  /** 单次 stale 恢复扫描处理的最大任务数 */
  STALE_SCAN_LIMIT: 100,
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
