/**
 * OperationLogMapper — 操作日志实体与 VO 的显式映射。
 *
 * 纯静态方法，无依赖注入。所有 Entity <-> VO 转换必须通过此 Mapper。
 */

import { DataMaskingUtil } from '@core/common';
import type { OperationLog } from '../entities/operation-log.entity';
import type {
  OperationLogDetailVo,
  OperationLogListItemVo,
} from '../vo/operation-log.vo';

export class OperationLogMapper {
  /**
   * 对详情 VO 中的 params/result 做返回侧二次脱敏。
   *
   * 入库时已脱敏，此处再脱敏一次作为纵深防御，防止历史数据或
   * 手动写入的日志将敏感字段透出到查询接口。
   */
  private static maskJson(
    value: object | null | undefined,
  ): object | null {
    if (!value || typeof value !== 'object') return null;
    return DataMaskingUtil.redactSensitiveKeys(
      value as Record<string, unknown>,
    );
  }

  /**
   * 转换为详情 VO。
   */
  static toDetailVo(log: OperationLog): OperationLogDetailVo {
    return {
      uid: log.uid,

      requestId: log.requestId,
      jti: log.jti,

      actorId: log.actorId,
      actorName: log.actorName,

      action: log.action,
      module: log.module,
      method: log.method,
      path: log.path,
      params: OperationLogMapper.maskJson(log.params),
      result: OperationLogMapper.maskJson(log.result),

      ip: log.ip,
      userAgent: log.userAgent,
      deviceType: log.deviceType,
      browser: log.browser,
      browserVersion: log.browserVersion,
      os: log.os,
      osVersion: log.osVersion,

      country: log.country,
      region: log.region,
      city: log.city,

      status: log.status,
      errorCode: log.errorCode,
      errorMessage: log.errorMessage,
      durationMs: log.durationMs,

      createdAt: log.createdAt,
    };
  }

  /**
   * 转换为列表项 VO。
   */
  static toListItemVo(log: OperationLog): OperationLogListItemVo {
    return {
      uid: log.uid,
      actorName: log.actorName,
      action: log.action,
      module: log.module,
      method: log.method,
      path: log.path,
      ip: log.ip,
      status: log.status,
      durationMs: log.durationMs,
      createdAt: log.createdAt,
    };
  }

  /**
   * 批量转换为列表项 VO 数组。
   */
  static toListItemVoArray(logs: OperationLog[]): OperationLogListItemVo[] {
    return logs.map((log) => OperationLogMapper.toListItemVo(log));
  }
}
