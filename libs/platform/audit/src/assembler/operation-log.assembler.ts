/**
 * OperationLogAssembler — 组装分页 VO 结果。
 *
 * 使用 OperationLogMapper + createPageResult 组合出分页响应。
 */

import { Injectable } from '@nestjs/common';
import { createPageResult } from '@core/common';
import type { PageResultVo } from '@core/common';
import { OperationLogMapper } from '../mapper/operation-log.mapper';
import type { OperationLog } from '../entities/operation-log.entity';
import type { OperationLogListItemVo } from '../vo/operation-log.vo';

@Injectable()
export class OperationLogAssembler {
  /**
   * 组装操作日志分页结果。
   */
  toPageResult(
    logs: OperationLog[],
    total: number,
    page: number,
    pageSize: number,
  ): PageResultVo<OperationLogListItemVo> {
    const items = OperationLogMapper.toListItemVoArray(logs);
    return createPageResult(items, total, page, pageSize);
  }
}
