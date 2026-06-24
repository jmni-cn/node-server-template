import { Injectable } from '@nestjs/common';
import { createPageResult } from '@core/common';
import type { PageResultVo } from '@core/common';
import { TaskMapper } from '../mapper';
import type { Task } from '../entities';
import type { TaskListItemVo } from '../vo';

/**
 * 任务装配器。
 *
 * 负责将实体集合 + 分页元信息组装为分页结果 VO。
 */
@Injectable()
export class TaskAssembler {
  /**
   * 组装任务列表分页结果。
   */
  toPageResult(
    tasks: Task[],
    total: number,
    page: number,
    pageSize: number,
  ): PageResultVo<TaskListItemVo> {
    const items = TaskMapper.toListItemVoArray(tasks);
    return createPageResult(items, total, page, pageSize);
  }
}
