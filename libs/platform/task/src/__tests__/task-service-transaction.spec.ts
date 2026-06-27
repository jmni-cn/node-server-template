import { EntityManager, Repository, DataSource } from 'typeorm';
import { LoggerService } from '@core/logger';
import { RuntimeConfigService } from '@platform/config';
import { QueueProducer } from '@platform/queue';
import { TaskService } from '../services/task.service';
import { Task } from '../entities/task.entity';
import { TaskStatus } from '../constants';
import type { CreateTaskInput } from '../types';

function createMockRepo<T extends Record<string, any>>(): jest.Mocked<
  Repository<T>
> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest
      .fn()
      .mockImplementation((e) => Promise.resolve({ uid: 'task-new-001', ...e })),
    create: jest.fn().mockImplementation((e) => ({ ...e })),
    createQueryBuilder: jest.fn(),
  } as unknown as jest.Mocked<Repository<T>>;
}

describe('TaskService — transaction methods', () => {
  let service: TaskService;
  let injectedRepo: jest.Mocked<Repository<Task>>;
  let managerRepo: jest.Mocked<Repository<Task>>;
  let mockManager: jest.Mocked<EntityManager>;
  let logger: jest.Mocked<LoggerService>;

  const baseInput: CreateTaskInput = {
    type: 'generic_task',
    bizType: 'ticket',
    bizUid: 'biz-001',
    priority: 0,
    maxAttempt: 3,
    dedupKey: 'generic_task:biz-001:create',
    inputJson: { bizUid: 'biz-001', trigger: 'created' },
  };

  beforeEach(() => {
    injectedRepo = createMockRepo<Task>();
    managerRepo = createMockRepo<Task>();

    mockManager = {
      getRepository: jest.fn().mockReturnValue(managerRepo),
    } as unknown as jest.Mocked<EntityManager>;

    logger = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    service = new TaskService(
      injectedRepo,
      {} as never,
      {} as unknown as DataSource,
      {} as unknown as QueueProducer,
      logger,
      { getNumber: jest.fn() } as unknown as RuntimeConfigService,
    );
  });

  describe('createTask with manager option', () => {
    it('should use manager.getRepository when manager is provided', async () => {
      managerRepo.findOneBy.mockResolvedValue(null);

      await service.createTask(baseInput, { manager: mockManager });

      expect(mockManager.getRepository).toHaveBeenCalledWith(Task);
      expect(managerRepo.create).toHaveBeenCalled();
      expect(managerRepo.save).toHaveBeenCalled();
      expect(injectedRepo.create).not.toHaveBeenCalled();
      expect(injectedRepo.save).not.toHaveBeenCalled();
    });

    it('should use injected repo when no manager is provided', async () => {
      injectedRepo.findOneBy.mockResolvedValue(null);

      await service.createTask(baseInput);

      expect(injectedRepo.create).toHaveBeenCalled();
      expect(injectedRepo.save).toHaveBeenCalled();
    });

    it('should dedup with manager repo when manager is provided', async () => {
      const existingTask = {
        uid: 'task-exist',
        dedupKey: baseInput.dedupKey,
        status: TaskStatus.PENDING,
      } as Task;
      managerRepo.findOneBy.mockResolvedValue(existingTask);

      const result = await service.createTask(baseInput, {
        manager: mockManager,
      });

      expect(result).toBe(existingTask);
      expect(managerRepo.create).not.toHaveBeenCalled();
      expect(managerRepo.save).not.toHaveBeenCalled();
    });

    it('should set defaults for status, attempt', async () => {
      managerRepo.findOneBy.mockResolvedValue(null);

      await service.createTask(baseInput, { manager: mockManager });

      expect(managerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TaskStatus.PENDING,
          attempt: 0,
          priority: 0,
          maxAttempt: 3,
        }),
      );
    });
  });

  describe('createTaskInTransaction', () => {
    it('should delegate to createTask with manager', async () => {
      managerRepo.findOneBy.mockResolvedValue(null);

      const result = await service.createTaskInTransaction(
        mockManager,
        baseInput,
      );

      expect(mockManager.getRepository).toHaveBeenCalledWith(Task);
      expect(result).toBeDefined();
      expect(result.type).toBe('generic_task');
    });

    it('should preserve dedup logic in transaction context', async () => {
      const existingTask = {
        uid: 'task-exist',
        dedupKey: baseInput.dedupKey,
      } as Task;
      managerRepo.findOneBy.mockResolvedValue(existingTask);

      const result = await service.createTaskInTransaction(
        mockManager,
        baseInput,
      );

      expect(result).toBe(existingTask);
      expect(managerRepo.create).not.toHaveBeenCalled();
    });
  });
});
