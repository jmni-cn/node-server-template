import { Test, type TestingModule } from '@nestjs/testing';
import type { Job } from 'bullmq';
import { LoggerService } from '@core/logger';
import { JOB_NAMES } from '@platform/queue';
import { OperationLogService } from '@platform/audit';
import { AuditLogProcessor } from '../../src/processors/audit/audit-log.processor';
import { operationLogJobFixture } from '../fixtures/jobs.fixture';

/**
 * AuditLogProcessor 集成测试：验证 WRITE_OPERATION_LOG job 会调用
 * OperationLogService.persistFromJob。OperationLogService 以 mock 替身注入，
 * 因此无需真实数据库。
 */
describe('AuditLogProcessor (integration)', () => {
  let processor: AuditLogProcessor;
  const persistFromJob = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogProcessor,
        { provide: OperationLogService, useValue: { persistFromJob } },
        {
          provide: LoggerService,
          useValue: { setContext: jest.fn(), log: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    processor = moduleRef.get(AuditLogProcessor);
  });

  it('persists operation log for WRITE_OPERATION_LOG job', async () => {
    const job = {
      name: JOB_NAMES.AUDIT.WRITE_OPERATION_LOG,
      queueName: 'audit',
      data: operationLogJobFixture,
    } as unknown as Job;

    await processor.process(job);

    expect(persistFromJob).toHaveBeenCalledWith(operationLogJobFixture);
  });

  it('throws for unknown job name', async () => {
    const job = {
      name: 'unknown',
      queueName: 'audit',
      data: {},
    } as unknown as Job;

    await expect(processor.process(job)).rejects.toThrow();
  });
});
