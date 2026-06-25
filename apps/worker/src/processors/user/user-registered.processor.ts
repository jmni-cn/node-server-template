import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { LoggerService } from '@core/logger';
import {
  BaseQueueProcessor,
  JOB_NAMES,
  QUEUE_NAMES,
  type UserEventJobData,
} from '@platform/queue';
import { UserLoginProcessor } from './user-login.processor';

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5);

/**
 * 用户事件处理器：持有 USER_EVENTS 队列的 WorkerHost，按 job 名分发。
 *
 * - `user-registered` → 本类处理（开户后续：欢迎通知 / 初始化等，模板做日志占位）；
 * - `user-logged-in`  → 委托 {@link UserLoginProcessor}；
 * - `password-changed` → 模板做日志占位。
 */
@Processor(QUEUE_NAMES.USER_EVENTS, { concurrency: CONCURRENCY })
export class UserRegisteredProcessor extends BaseQueueProcessor {
  protected handlers = {
    [JOB_NAMES.USER_EVENTS.USER_REGISTERED]: (job: Job) =>
      this.onRegistered(job.data as UserEventJobData),
    [JOB_NAMES.USER_EVENTS.USER_LOGGED_IN]: (job: Job) =>
      this.loginProcessor.handle(job.data as UserEventJobData),
    [JOB_NAMES.USER_EVENTS.PASSWORD_CHANGED]: (job: Job) =>
      this.onPasswordChanged(job.data as UserEventJobData),
  };

  constructor(
    private readonly loginProcessor: UserLoginProcessor,
    private readonly logger: LoggerService,
  ) {
    super();
    this.logger.setContext(UserRegisteredProcessor.name);
  }

  private onRegistered(data: UserEventJobData): Promise<void> {
    this.logger.log('User registered event processed', {
      sub: data.sub,
      username: data.username,
    });
    // 模板占位：开户后续（欢迎通知/初始化等）接入后改回 async 并 await。
    return Promise.resolve();
  }

  private onPasswordChanged(data: UserEventJobData): Promise<void> {
    this.logger.log('Password changed event processed', { sub: data.sub });
    return Promise.resolve();
  }
}
