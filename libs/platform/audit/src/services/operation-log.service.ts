/**
 * OperationLogService — 操作日志写入服务。
 *
 * 负责创建操作日志、以及消费队列 job 落库（worker 调用 persistFromJob）。
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '@core/common';
import { LoggerService } from '@core/logger';
import type { OperationLogJobData } from '@platform/queue';
import { OperationLog } from '../entities/operation-log.entity';
import { AuditErrorCode } from '../constants/audit-error-codes';
import type { CreateOperationLogInput } from '../types';

@Injectable()
export class OperationLogService {
  constructor(
    @InjectRepository(OperationLog)
    private readonly operationLogRepository: Repository<OperationLog>,
    private readonly logger: LoggerService,
  ) {}

  /**
   * 创建操作日志。
   */
  async create(input: CreateOperationLogInput): Promise<OperationLog> {
    try {
      const log = this.operationLogRepository.create({
        requestId: input.requestId ?? null,
        jti: input.jti ?? null,

        actorId: input.actorId,
        actorName: input.actorName,

        action: input.action,
        module: input.module,
        method: input.method,
        path: input.path,
        params: input.params,
        result: input.result,

        ip: input.ip,
        userAgent: input.userAgent,
        deviceType: input.deviceType ?? null,
        browser: input.browser ?? null,
        browserVersion: input.browserVersion ?? null,
        os: input.os ?? null,
        osVersion: input.osVersion ?? null,

        country: input.country ?? null,
        region: input.region ?? null,
        city: input.city ?? null,

        status: input.status,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        durationMs: input.durationMs ?? null,
      });

      return await this.operationLogRepository.save(log);
    } catch (error) {
      this.logger.error(
        `Failed to create operation log: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new BusinessException(AuditErrorCode.OP_LOG_CREATE_FAILED);
    }
  }

  /**
   * 从队列 job 负载落库（worker 使用）。
   */
  async persistFromJob(data: OperationLogJobData): Promise<void> {
    await this.create({
      requestId: data.requestId,
      jti: data.jti,

      actorId: data.sub,
      actorName: data.username,

      action: data.action,
      module: data.module,
      method: data.method,
      path: data.path,
      params: data.params,
      result: data.result,

      ip: data.ip,
      userAgent: data.userAgent,
      deviceType: data.deviceType,
      browser: data.browser,
      browserVersion: data.browserVersion,
      os: data.os,
      osVersion: data.osVersion,

      country: data.country,
      region: data.region,
      city: data.city,

      status: data.success ? 'success' : 'failed',
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
      durationMs: data.duration,
    });
  }
}
