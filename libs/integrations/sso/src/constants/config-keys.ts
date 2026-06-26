/**
 * SSO 运行时配置键常量（单一事实源）。
 *
 * 注册（{@link SsoModule} 的 registerConfigDefinitions）与消费方
 * （SsoCallbackService）共用同一组键，避免字符串字面量散落、漂移。
 * 仅「策略」类键在此注册并热更新；机密项（clientId/clientSecret 等）仍走纯 env。
 */
export const SSO_CONFIG_KEYS = {
  /** 终端用户 SSO 首次登录是否允许自动开户。 */
  ALLOW_AUTO_REGISTER: 'sso.policy.allow_auto_register',
  /** 自动开户允许的邮箱域白名单（数组，空数组表示不限制）。 */
  ALLOWED_EMAIL_DOMAINS: 'sso.policy.allowed_email_domains',
} as const;

/** SSO 配置键联合类型。 */
export type SsoConfigKey =
  (typeof SSO_CONFIG_KEYS)[keyof typeof SSO_CONFIG_KEYS];
