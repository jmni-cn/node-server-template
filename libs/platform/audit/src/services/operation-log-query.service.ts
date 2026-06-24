/**
 * OperationLogQueryService — 操作日志查询服务。
 *
 * 负责分页查询与详情查询，返回 VO。
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createPageResult, BusinessException } from '@core/common';
import type { PageResultVo } from '@core/common';
import { OperationLog } from '../entities/operation-log.entity';
import { OperationLogMapper } from '../mapper/operation-log.mapper';
import { AuditErrorCode } from '../constants/audit-error-codes';
import type { OperationLogQueryParams } from '../types';
import type {
  OperationLogDetailVo,
  OperationLogListItemVo,
} from '../vo/operation-log.vo';

@Injectable()
export class OperationLogQueryService {
  constructor(
    @InjectRepository(OperationLog)
    private readonly operationLogRepository: Repository<OperationLog>,
  ) {}

  /**
   * 分页查询操作日志。
   */
  async query(
    params: OperationLogQueryParams,
  ): Promise<PageResultVo<OperationLogListItemVo>> {
    const {
      page = 1,
      pageSize = 10,
      module,
      action,
      actorId,
      status,
      startTime,
      endTime,
    } = params;

    const qb = this.operationLogRepository.createQueryBuilder('log');

    if (module) {
      qb.andWhere('log.module = :module', { module });
    }
    if (action) {
      qb.andWhere('log.action LIKE :action', { action: `%${action}%` });
    }
    if (actorId) {
      qb.andWhere('log.actorId = :actorId', { actorId });
    }
    if (status) {
      qb.andWhere('log.status = :status', { status });
    }
    if (startTime && endTime) {
      qb.andWhere('log.createdAt BETWEEN :startTime AND :endTime', {
        startTime,
        endTime,
      });
    } else if (startTime) {
      qb.andWhere('log.createdAt >= :startTime', { startTime });
    } else if (endTime) {
      qb.andWhere('log.createdAt <= :endTime', { endTime });
    }

    qb.orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [logs, total] = await qb.getManyAndCount();

    const items = OperationLogMapper.toListItemVoArray(logs);
    return createPageResult(items, total, page, pageSize);
  }

  /**
   * 根据 UID 查询操作日志详情。
   */
  async findByUid(uid: string): Promise<OperationLogDetailVo> {
    const log = await this.operationLogRepository.findOne({ where: { uid } });

    if (!log) {
      throw new BusinessException(AuditErrorCode.OP_LOG_NOT_FOUND);
    }

    return OperationLogMapper.toDetailVo(log);
  }
}
