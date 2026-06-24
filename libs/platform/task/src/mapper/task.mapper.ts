import type { Task } from '../entities';
import type { TaskVo, TaskListItemVo } from '../vo';

/**
 * 任务实体 → 视图对象映射器。
 *
 * 纯静态、无依赖注入，仅负责结构转换。
 */
export class TaskMapper {
  /**
   * 转换为任务详情视图对象。
   */
  static toVo(task: Task): TaskVo {
    return {
      uid: task.uid,
      name: task.name,
      type: task.type,
      status: task.status,
      attempts: task.attempts,
      maxAttempts: task.maxAttempts,
      scheduledAt: task.scheduledAt,
      startedAt: task.startedAt,
      finishedAt: task.finishedAt,
      error: task.error,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  /**
   * 转换为任务列表项视图对象。
   */
  static toListItemVo(task: Task): TaskListItemVo {
    return {
      uid: task.uid,
      name: task.name,
      type: task.type,
      status: task.status,
      attempts: task.attempts,
      createdAt: task.createdAt,
    };
  }

  /**
   * 批量转换为任务列表项视图对象。
   */
  static toListItemVoArray(tasks: Task[]): TaskListItemVo[] {
    return tasks.map((task) => this.toListItemVo(task));
  }
}
