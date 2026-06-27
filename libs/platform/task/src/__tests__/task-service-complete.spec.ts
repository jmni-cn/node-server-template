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

/**
 * completeTask 成功时清除上一次失败/重试残留的错误字段（D7），
 * 同时验证幂等（M4）：已 SUCCESS 的任务重复 complete 直接返回，不改写、不抛错。
 */
describe('TaskService.completeTask clears errors (D7) + idempotency (M4)', () => {
  let service: TaskService;
  let taskRepo: jest.Mocked<Repository<Task>>;

  beforeEach(() => {
    taskRepo = {
      findOneBy: jest.fn(),
      // save 回显传入实体
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
    } as unknown as jest.Mocked<Repository<Task>>;

    service = new TaskService(
      taskRepo,
      {} as never,
      {} as unknown as DataSource,
      {} as unknown as QueueProducer,
      createMockLogger(),
      { getNumber: jest.fn() } as unknown as RuntimeConfigService,
    );
  });

  it('PROCESSING 任务带残留 errorCode/errorMessage → 完成后置 SUCCESS 且错误字段清空为 null', async () => {
    const task = {
      uid: 't1',
      status: TaskStatus.PROCESSING,
      errorCode: 'ANALYSIS_FAILED',
      errorMessage: 'Business Exception',
    } as unknown as Task;
    taskRepo.findOneBy.mockResolvedValue(task);

    const saved = await service.completeTask('t1', { outcome: 'SUCCESS' });

    expect(saved.status).toBe(TaskStatus.SUCCESS);
    expect(saved.errorCode).toBeNull();
    expect(saved.errorMessage).toBeNull();
    expect(saved.outputJson).toEqual({ outcome: 'SUCCESS' });
    expect(taskRepo.save).toHaveBeenCalledTimes(1);
  });

  it('已 SUCCESS 的任务 → 幂等返回原任务，不调用 save，不抛错', async () => {
    const task = {
      uid: 't2',
      status: TaskStatus.SUCCESS,
      errorCode: null,
      errorMessage: null,
    } as unknown as Task;
    taskRepo.findOneBy.mockResolvedValue(task);

    const result = await service.completeTask('t2', { outcome: 'SUCCESS' });

    expect(result).toBe(task);
    expect(result.status).toBe(TaskStatus.SUCCESS);
    expect(taskRepo.save).not.toHaveBeenCalled();
  });
});
