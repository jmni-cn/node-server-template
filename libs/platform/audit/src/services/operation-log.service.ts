/**
 * OperationLogService — 操作日志写入服务。
 *
 * 负责创建操作日志、以及消费队列 job 落库（worker 调用 persistFromJob）。
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException, DataMaskingUtil } from '@core/common';
import { LoggerService } from '@core/logger';
import { RequestContextService } from '@core/request-context';
import type { OperationLogJobData } from '@platform/queue';
import { OperationLog } from '../entities/operation-log.entity';
import { AuditErrorCode } from '../constants/audit-error-codes';
import type { CreateOperationLogInput } from '../types';

/**
 * 手动审计入参（用于无法走 OperationLogInterceptor 的场景，
 * 如 @Res() 直接 redirect 的 SSO 回调）。
 *
 * 仅需提供业务关键字段，操作人 / 客户端 / 设备 / 地理位置等
 * 一律从 RequestContext 兜底填充。
 */
export interface CreateWithContextInput {
  action: string;
  module: string;
  method: string;
  path: string;
  params?: object | null;
  result?: object | null;
  /** 显式指定操作人（缺省时从 RequestContext 读取） */
  sub?: string | null;
  username?: string | null;
  success?: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
  durationMs?: number | null;
}

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

  /**
   * 手动写入操作日志（同步落库，不入队）。
   *
   * 供无法走 OperationLogInterceptor 的场景使用，典型如 SSO 回调
   * 使用 @Res() 直接 redirect、响应体非标准格式无法被拦截器解析。
   * 操作人 / IP / 设备 / 地理位置等从 RequestContext 兜底填充，
   * params/result 经 DataMaskingUtil 脱敏后落库。
   *
   * 写入失败仅记日志，不抛出，避免污染主链路。
   */
  async createWithContext(input: CreateWithContextInput): Promise<void> {
    const deviceInfo = RequestContextService.getDeviceInfo();
    const geo = RequestContextService.getGeoLocation();

    try {
      await this.create({
        requestId: RequestContextService.getRequestId() ?? null,
        jti: RequestContextService.getJti() ?? null,

        actorId: input.sub ?? RequestContextService.getSub() ?? null,
        actorName: input.username ?? RequestContextService.getUsername() ?? null,

        action: input.action,
        module: input.module,
        method: input.method,
        path: input.path,
        params: this.maskJson(input.params),
        result: this.maskJson(input.result),

        ip: RequestContextService.getIp() ?? null,
        userAgent: RequestContextService.getUserAgent() ?? null,
        deviceType: deviceInfo?.deviceType ?? null,
        browser: deviceInfo?.browser ?? null,
        browserVersion: deviceInfo?.browserVersion ?? null,
        os: deviceInfo?.os ?? null,
        osVersion: deviceInfo?.osVersion ?? null,

        country: geo?.country ?? null,
        region: geo?.region ?? null,
        city: geo?.city ?? null,

        status: input.success === false ? 'failed' : 'success',
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        durationMs: input.durationMs ?? null,
      });
    } catch (error) {
      // create 内部已记录错误并抛 BusinessException；此处吞掉，保证主链路不受影响。
      this.logger.warn(
        `createWithContext 写入操作日志失败: ${(error as Error).message}`,
      );
    }
  }

  /** 对 params/result 做脱敏（敏感字段替换为占位符）。 */
  private maskJson(value: object | null | undefined): object | null {
    if (!value || typeof value !== 'object') return null;
    return DataMaskingUtil.redactSensitiveKeys(
      value as Record<string, unknown>,
    );
  }
}
