import { Injectable } from '@nestjs/common';
import { LoggerService } from '@core/logger';
import type { UserEventJobData } from '@platform/queue';

/**
 * 用户登录事件处理器。
 *
 * 注意：BullMQ 每个队列只能有一个 WorkerHost，因此 USER_EVENTS 队列的
 * WorkerHost 由 {@link UserRegisteredProcessor} 持有，并按 job 名将
 * `user-logged-in` 委托到本处理器。本类不带 `@Processor`，作为可注入协作者。
 *
 * 这里仅做登录事件的副作用（如审计、风控、最近登录设备记录）。本模板做日志占位。
 */
@Injectable()
export class UserLoginProcessor {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext(UserLoginProcessor.name);
  }

  async handle(data: UserEventJobData): Promise<void> {
    this.logger.log('User logged in event processed', {
      sub: data.sub,
      username: data.username,
    });
  }
}
