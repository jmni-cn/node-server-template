/**
 * 任务状态枚举。
 *
 * 生命周期：PENDING → RUNNING → SUCCESS / FAILED；
 * FAILED 可经由重试进入 RETRYING，随后再次 RUNNING。
 */
export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
}
