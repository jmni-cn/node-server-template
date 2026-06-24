import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { LoggerService } from '@core/logger';
import {
  BaseQueueProcessor,
  JOB_NAMES,
  QUEUE_NAMES,
  type SsoSyncJobData,
} from '@platform/queue';
import { ExternalIdentityService } from '@domains/identity';

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5);

/**
 * SSO 资料同步处理器：消费 SSO_SYNC 队列。
 *
 * 入队方为 @integrations/sso 的回调流程。这里做外部身份对账：确认绑定存在
 * （后续可扩展为拉取最新资料回填）。本模板以查询 + 日志占位。
 */
@Processor(QUEUE_NAMES.SSO_SYNC, { concurrency: CONCURRENCY })
export class SsoProfileSyncProcessor extends BaseQueueProcessor {
  protected handlers = {
    [JOB_NAMES.SSO_SYNC.SYNC_PROFILE]: (job: Job) =>
      this.sync(job.data as SsoSyncJobData),
  };

  constructor(
    private readonly externalIdentityService: ExternalIdentityService,
    private readonly logger: LoggerService,
  ) {
    super();
    this.logger.setContext(SsoProfileSyncProcessor.name);
  }

  private async sync(data: SsoSyncJobData): Promise<void> {
    const identity = await this.externalIdentityService.findByProvider(
      data.subjectType,
      data.provider,
      data.externalId,
    );
    this.logger.log('SSO profile sync processed', {
      subjectType: data.subjectType,
      provider: data.provider,
      externalId: data.externalId,
      linked: Boolean(identity),
    });
  }
}
