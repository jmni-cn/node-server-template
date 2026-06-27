/**
 * 任务状态枚举（通用富任务引擎）。
 *
 * 生命周期（CAS 状态机）：
 *   PENDING ──claim──▶ PROCESSING ──complete──▶ SUCCESS
 *                                   └──fail──▶ FAILED（重试耗尽）
 *                                   └──fail──▶ RETRYING（尚有重试次数）──dispatch──▶ PROCESSING
 *   PENDING / RETRYING ──cancel──▶ CANCELLED
 *   非终态 ──skip──▶ SKIPPED
 *
 * 终态：SUCCESS / FAILED / CANCELLED / SKIPPED（可被 retention 清理）。
 * 值以小写字符串存储（DB varchar），保持跨服务一致。
 */
export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying',
  SKIPPED = 'skipped',
}

/** 可认领（claim）状态：仅这些状态允许 worker 抢占执行。 */
export const CLAIMABLE_STATUSES: TaskStatus[] = [
  TaskStatus.PENDING,
  TaskStatus.RETRYING,
];

/** 可取消（cancel）状态：仅尚未执行的任务允许取消。 */
export const CANCELLABLE_STATUSES: TaskStatus[] = [
  TaskStatus.PENDING,
  TaskStatus.RETRYING,
];

/** 可投递（dispatch）状态：dispatcher 仅捞取这些状态的任务。 */
export const DISPATCHABLE_STATUSES: TaskStatus[] = [
  TaskStatus.PENDING,
  TaskStatus.RETRYING,
];

/** 终态状态：只有这些状态的任务可被 retention 清理。 */
export const TERMINAL_STATUSES: TaskStatus[] = [
  TaskStatus.SUCCESS,
  TaskStatus.FAILED,
  TaskStatus.CANCELLED,
  TaskStatus.SKIPPED,
];
