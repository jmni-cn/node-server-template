import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { assertSortWhitelist, createPageResult } from '@core/common';
import type { PageResultVo } from '@core/common';
import { Task, TaskLog } from '../entities';
import { TaskMapper } from '../mapper';
import type { TaskListItemVo } from '../vo';
import type { TaskQueryParams } from '../types';

/** 任务列表允许排序的字段白名单（防任意字段排序 / SQL 注入）。 */
const TASK_SORT_WHITELIST = [
  'createdAt',
  'updatedAt',
  'scheduledAt',
  'startedAt',
  'finishedAt',
  'status',
] as const;

/**
 * 任务查询服务：列表分页查询与日志读取（只读）。
 */
@Injectable()
export class TaskQueryService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(TaskLog)
    private readonly logRepo: Repository<TaskLog>,
  ) {}

  /**
   * 按条件分页查询任务列表，按创建时间倒序。
   */
  async query(params: TaskQueryParams): Promise<PageResultVo<TaskListItemVo>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;

    const qb = this.taskRepo.createQueryBuilder('task');

    if (params.type) {
      qb.andWhere('task.type = :type', { type: params.type });
    }
    if (params.status) {
      qb.andWhere('task.status = :status', { status: params.status });
    }

    const sortBy =
      assertSortWhitelist(params.sortBy, TASK_SORT_WHITELIST) ?? 'createdAt';
    qb.orderBy(`task.${sortBy}`, params.order ?? 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [tasks, total] = await qb.getManyAndCount();
    const items = TaskMapper.toListItemVoArray(tasks);
    return createPageResult(items, total, page, pageSize);
  }

  /**
   * 读取指定任务的日志，按创建时间正序。
   */
  async getLogs(taskUid: string): Promise<TaskLog[]> {
    return this.logRepo.find({
      where: { taskUid },
      order: { createdAt: 'ASC' },
    });
  }
}
