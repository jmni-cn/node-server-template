/**
 * @platform/queue — 每个队列下的 job 名称。
 *
 * 结构为 `JOB_NAMES[<QUEUE_KEY>][<JOB_KEY>] = '<job-name>'`，
 * producer 入队与 worker processor 的 switch 分发共用。
 */
export const JOB_NAMES = {
  AUDIT: {
    /** 写入一条操作日志 */
    WRITE_OPERATION_LOG: 'write-operation-log',
  },
  USER_EVENTS: {
    /** 用户已注册 */
    USER_REGISTERED: 'user-registered',
    /** 用户已登录 */
    USER_LOGGED_IN: 'user-logged-in',
    /** 密码已变更 */
    PASSWORD_CHANGED: 'password-changed',
  },
  SSO_SYNC: {
    /** 同步 SSO 用户资料 */
    SYNC_PROFILE: 'sync-profile',
  },
  TASK: {
    /** 执行一个通用任务 */
    EXECUTE: 'execute-task',
    /** 重试一个失败任务 */
    RETRY: 'retry-task',
  },
  SYSTEM: {
    /** 清理过期数据 */
    CLEANUP: 'cleanup',
  },
  DEAD_LETTER: {
    /** 一条重试耗尽的死信记录（元数据：原队列 / job 名 / 负载 / 失败原因） */
    RECORD: 'dead-letter-record',
  },
} as const;
