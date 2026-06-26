/**
 * 安全/风控运行时配置键常量（单一事实源）。
 *
 * 注册（{@link SecurityModule} 的 registerConfigDefinitions）与消费方
 * （LoginService / IpBlacklistService 等）共用同一组键，避免字符串字面量散落、漂移。
 * 默认值统一在定义注册表中声明一处，消费方调用 RuntimeConfigService getter 时
 * 可省略内联默认（getter 未传 defaultValue 时回退到注册表 def.defaultValue）。
 */
export const SECURITY_CONFIG_KEYS = {
  /** 触发账户锁定的连续登录失败阈值。 */
  LOGIN_MAX_FAILED: 'security.login.max_failed',
  /** 账户锁定时长（分钟）。 */
  LOGIN_LOCK_MINUTES: 'security.login.lock_minutes',
  /** IP 风控滑动窗口（秒）。 */
  IP_SUSPICIOUS_WINDOW_SECONDS: 'security.ip.suspicious_window_seconds',
  /** 窗口内同 IP 失败累计触发自动封禁的阈值。 */
  IP_SUSPICIOUS_THRESHOLD: 'security.ip.suspicious_threshold',
  /** IP 自动封禁时长（秒）。 */
  IP_BAN_SECONDS: 'security.ip.ban_seconds',
} as const;

/** 安全配置键联合类型。 */
export type SecurityConfigKey =
  (typeof SECURITY_CONFIG_KEYS)[keyof typeof SECURITY_CONFIG_KEYS];
