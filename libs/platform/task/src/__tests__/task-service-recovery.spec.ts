import { Repository, DataSource } from 'typeorm';
import { LoggerService } from '@core/logger';
import { RuntimeConfigService } from '@platform/config';
import { QueueProducer } from '@platform/queue';
import { TaskService } from '../services/task.service';
import { Task } from '../entities/task.entity';
import { TaskStatus } from '../constants';

function createMockLogger(): jest.Mocked<LoggerService> {
  return {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  } as unknown as jest.Mocked<LoggerService>;
}

function createMockRuntimeConfig(): jest.Mocked<RuntimeConfigService> {
  return {
    // recoverStaleTasks 缺省读取 STALE_MINUTES / STALE_SCAN_LIMIT。
    getNumber: jest.fn().mockResolvedValue(15),
  } as unknown as jest.Mocked<RuntimeConfigService>;
}

describe('TaskService — 卡死恢复(H7) + 幂等(M4) + 原子去重(M8)', () => {
  let service: TaskService;
  let taskRepo: jest.Mocked<Repository<Task>>;
  let updateQb: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    execute: jest.Mock;
  };
  let selectQb: {
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    take: jest.Mock;
    getMany: jest.Mock;
  };

  beforeEach(() => {
    updateQb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    selectQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    taskRepo = {
      findOneBy: jest.fn(),
      create: jest.fn().mockImplementation((e) => ({ ...e })),
      save: jest
        .fn()
        .mockImplementation((e) => Promise.resolve({ uid: 'task-new', ...e })),
      createQueryBuilder: jest
        .fn()
        .mockImplementation((alias?: string) => (alias ? selectQb : updateQb)),
    } as unknown as jest.Mocked<Repository<Task>>;

    service = new TaskService(
      taskRepo,
      {} as never,
      {} as unknown as DataSource,
      {} as unknown as QueueProducer,
      createMockLogger(),
      createMockRuntimeConfig(),
    );
  });

  // ── H7: recoverStaleTasks ──────────────────────────────────

  describe('recoverStaleTasks (H7)', () => {
    const staleTask = (attempt: number, maxAttempt = 3) =>
      ({
        uid: 'task-stale',
        type: 'generic_task',
        status: TaskStatus.PROCESSING,
        attempt,
        maxAttempt,
        lockedAt: new Date('2026-06-11T00:00:00Z'),
        lockedBy: 'worker-dead',
      }) as unknown as Task;

    it('attempt < maxAttempt 的卡死任务 → CAS 重置为 RETRYING', async () => {
      selectQb.getMany.mockResolvedValue([staleTask(1)]);

      const result = await service.recoverStaleTasks({ staleMinutes: 15 });

      expect(result).toEqual({ scanned: 1, retried: 1, failed: 0 });
      expect(updateQb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TaskStatus.RETRYING,
          lockedBy: null,
          lockedAt: null,
          errorCode: 'TASK_STALE_RECOVERED',
        }),
      );
    });

    it('attempt >= maxAttempt 的卡死任务 → FAILED（管理端可见原因）', async () => {
      selectQb.getMany.mockResolvedValue([staleTask(3)]);

      const result = await service.recoverStaleTasks({ staleMinutes: 15 });

      expect(result).toEqual({ scanned: 1, retried: 0, failed: 1 });
      expect(updateQb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TaskStatus.FAILED,
          errorCode: 'TASK_STALE_TIMEOUT',
        }),
      );
    });

    it('CAS 不命中（任务恰好被正常 complete）→ 不计入恢复', async () => {
      selectQb.getMany.mockResolvedValue([staleTask(1)]);
      updateQb.execute.mockResolvedValue({ affected: 0 });

      const result = await service.recoverStaleTasks();

      expect(result).toEqual({ scanned: 1, retried: 0, failed: 0 });
    });

    it('无卡死任务 → 空扫描', async () => {
      const result = await service.recoverStaleTasks();
      expect(result).toEqual({ scanned: 0, retried: 0, failed: 0 });
    });
  });

  // ── M4: completeTask / failTask 幂等 ──────────────────────

  describe('completeTask / failTask 幂等 (M4)', () => {
    it('completeTask 对已 SUCCESS 的任务 → 幂等返回，不抛错不重写', async () => {
      taskRepo.findOneBy.mockResolvedValue({
        uid: 't1',
        status: TaskStatus.SUCCESS,
      } as unknown as Task);

      const result = await service.completeTask('t1', { outcome: 'X' });

      expect(result.status).toBe(TaskStatus.SUCCESS);
      expect(taskRepo.save).not.toHaveBeenCalled();
    });

    it('completeTask 对 PENDING 的任务 → 仍抛 TASK_INVALID_STATE', async () => {
      taskRepo.findOneBy.mockResolvedValue({
        uid: 't1',
        status: TaskStatus.PENDING,
      } as unknown as Task);

      await expect(service.completeTask('t1', {})).rejects.toMatchObject({
        errorCode: 'TASK_INVALID_STATE',
      });
    });

    it.each([TaskStatus.FAILED, TaskStatus.RETRYING])(
      'failTask 对已 %s 的任务 → 幂等返回，不抛错',
      async (status) => {
        taskRepo.findOneBy.mockResolvedValue({
          uid: 't1',
          status,
        } as unknown as Task);

        const result = await service.failTask('t1', 'E', 'msg');

        expect(result.status).toBe(status);
        expect(taskRepo.save).not.toHaveBeenCalled();
      },
    );
  });

  // ── M8: createTask ER_DUP_ENTRY 回查 ──────────────────────

  describe('createTask 并发去重 (M8)', () => {
    it('save 抛 ER_DUP_ENTRY 且有 dedupKey → 回查返回既有任务', async () => {
      const existing = {
        uid: 'task-existing',
        status: TaskStatus.PENDING,
      } as unknown as Task;
      taskRepo.findOneBy
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);
      taskRepo.save.mockRejectedValue(
        Object.assign(new Error('ER_DUP_ENTRY: Duplicate entry'), {
          code: 'ER_DUP_ENTRY',
        }),
      );

      const result = await service.createTask({ type: 'generic_task', dedupKey: 'k1' });

      expect(result.uid).toBe('task-existing');
    });

    it('save 抛非重复键错误 → 原样抛出', async () => {
      taskRepo.findOneBy.mockResolvedValue(null);
      taskRepo.save.mockRejectedValue(new Error('connection lost'));

      await expect(
        service.createTask({ type: 'generic_task', dedupKey: 'k1' }),
      ).rejects.toThrow('connection lost');
    });
  });
});
