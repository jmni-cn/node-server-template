import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { nowUtc } from '@core/common';
import { LoggerService } from '@core/logger';
import { Task } from '../entities';
import { TaskStatus, TERMINAL_STATUSES } from '../constants';

/**
 * 终态任务清理命令。
 */
export interface CleanupTerminalTasksCommand {
  /** SUCCESS 任务保留天数，默认 30。 */
  successOlderThanDays?: number;
  /** FAILED / CANCELLED / SKIPPED 任务保留天数，默认 90。 */
  failedOlderThanDays?: number;
  /** 限定清理的任务类型（通用字符串数组），不传则清理所有类型。 */
  types?: string[];
  /** 单次最大清理条数，默认 1000。 */
  limit?: number;
  /** 试运行模式 —— 只统计不删除。 */
  dryRun?: boolean;
}

/**
 * 终态任务清理结果。
 */
export interface CleanupTerminalTasksResult {
  matchedCount: number;
  cleanedCount: number;
  dryRun: boolean;
  successCleaned: number;
  failedCleaned: number;
}

/**
 * 任务保留 / 清理服务。
 *
 * 按保留期软删除终态任务（SUCCESS / FAILED / CANCELLED / SKIPPED），
 * SUCCESS 与其它终态可配置不同保留天数。任务类型 `type` 为通用字符串过滤维度。
 */
@Injectable()
export class TaskRetentionService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(TaskRetentionService.name);
  }

  async cleanupTerminalTasks(
    command: CleanupTerminalTasksCommand = {},
  ): Promise<CleanupTerminalTasksResult> {
    const successDays = command.successOlderThanDays ?? 30;
    const failedDays = command.failedOlderThanDays ?? 90;
    const limit = command.limit ?? 1000;
    const dryRun = command.dryRun ?? false;

    const now = nowUtc();
    const successCutoff = new Date(now.getTime() - successDays * 86_400_000);
    const failedCutoff = new Date(now.getTime() - failedDays * 86_400_000);

    // SUCCESS 终态任务。
    const successQuery = this.taskRepo
      .createQueryBuilder('t')
      .where('t.status = :status', { status: TaskStatus.SUCCESS })
      .andWhere('t.finished_at < :cutoff', { cutoff: successCutoff })
      .andWhere('t.deleted_at IS NULL');

    if (command.types?.length) {
      successQuery.andWhere('t.type IN (:...types)', { types: command.types });
    }

    const successTasks = await successQuery
      .orderBy('t.finished_at', 'ASC')
      .take(limit)
      .getMany();

    // FAILED / CANCELLED / SKIPPED 终态任务。
    const otherStatuses = TERMINAL_STATUSES.filter(
      (s) => s !== TaskStatus.SUCCESS,
    );
    const failedQuery = this.taskRepo
      .createQueryBuilder('t')
      .where('t.status IN (:...statuses)', { statuses: otherStatuses })
      .andWhere('t.finished_at < :cutoff', { cutoff: failedCutoff })
      .andWhere('t.deleted_at IS NULL');

    if (command.types?.length) {
      failedQuery.andWhere('t.type IN (:...types)', { types: command.types });
    }

    const remaining = limit - successTasks.length;
    const failedTasks =
      remaining > 0
        ? await failedQuery
            .orderBy('t.finished_at', 'ASC')
            .take(remaining)
            .getMany()
        : [];

    const allTasks = [...successTasks, ...failedTasks];
    const matchedCount = allTasks.length;
    let cleanedCount = 0;

    if (!dryRun && allTasks.length > 0) {
      // TypeORM softDelete（设置 deleted_at）。
      const uids = allTasks.map((t) => t.uid);
      await this.taskRepo.softDelete({ uid: In(uids) });
      cleanedCount = uids.length;
    }

    this.logger.log('Terminal task cleanup completed', {
      dryRun,
      matchedCount,
      cleanedCount,
      successCleaned: dryRun ? 0 : successTasks.length,
      failedCleaned: dryRun ? 0 : failedTasks.length,
      successCutoff: successCutoff.toISOString(),
      failedCutoff: failedCutoff.toISOString(),
    });

    return {
      matchedCount,
      cleanedCount: dryRun ? 0 : cleanedCount,
      dryRun,
      successCleaned: dryRun ? 0 : successTasks.length,
      failedCleaned: dryRun ? 0 : failedTasks.length,
    };
  }
}
