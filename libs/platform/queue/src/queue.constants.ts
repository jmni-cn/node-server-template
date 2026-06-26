/**
 * @platform/queue — 队列名称常量。
 *
 * 所有 BullMQ 队列名集中在此定义，apps（producer 侧）与 worker（processor 侧）共用，
 * 避免字符串硬编码漂移。
 */
export const QUEUE_NAMES = {
  /** 审计 / 操作日志写入 */
  AUDIT: 'audit',
  /** 用户领域事件（注册、登录等） */
  USER_EVENTS: 'user-events',
  /** SSO / 第三方身份同步 */
  SSO_SYNC: 'sso-sync',
  /** 通用后台任务（platform/task 驱动） */
  TASK: 'task',
  /** 系统级任务（清理、聚合、定时） */
  SYSTEM: 'system',
  /**
   * 死信队列（DLQ）：job 重试次数耗尽（attemptsMade >= opts.attempts）后，
   * 将其元数据转投此处，供人工排查 / 重放，避免失败 job 被静默丢弃。
   * 约定见 references/QUEUE-SPEC.md「Dead-letter queue」。
   */
  DEAD_LETTER: 'dead-letter',
} as const;

/** 队列名称字面量联合类型。 */
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** 全部队列名数组（用于 worker 批量注册）。 */
export const ALL_QUEUE_NAMES: QueueName[] = Object.values(QUEUE_NAMES);
