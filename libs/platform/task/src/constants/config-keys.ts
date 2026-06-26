/**
 * 任务可靠性运行时配置键常量（单一事实源）。
 *
 * 注册（{@link TaskModule} 的 registerConfigDefinitions）与消费方
 * （TaskService）共用同一组键，避免字符串字面量散落、漂移。
 * 默认值统一在定义注册表中声明一处，消费方调用 RuntimeConfigService getter 时
 * 可省略内联默认（getter 未传 defaultValue 时回退到注册表 def.defaultValue）。
 */
export const TASK_CONFIG_KEYS = {
  /** 投递租约宽限秒数（仅重投早于 now-该值的任务）。 */
  DISPATCH_LEASE_GRACE_SECONDS: 'task.reliability.dispatch_lease_grace_seconds',
  /** dispatcher 单次扫描上限。 */
  DISPATCH_SCAN_LIMIT: 'task.reliability.dispatch_scan_limit',
  /** stale 判定分钟数。 */
  STALE_MINUTES: 'task.reliability.stale_minutes',
  /** stale 恢复单次扫描上限。 */
  STALE_SCAN_LIMIT: 'task.reliability.stale_scan_limit',
} as const;

/** 任务配置键联合类型。 */
export type TaskConfigKey =
  (typeof TASK_CONFIG_KEYS)[keyof typeof TASK_CONFIG_KEYS];
