/**
 * AuditModule — 审计模块。
 *
 * 提供操作日志写入/查询服务、组装器与拦截器。
 * - 拦截器读取 @OperationLogDecorator 元数据，将日志入队到 AUDIT 队列；
 * - worker 侧通过 OperationLogService.persistFromJob 落库。
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from '@core/logger';
import { registerErrorCodeHttpStatus } from '@core/common';
import { QueueModule, QUEUE_NAMES } from '@platform/queue';
import { OperationLog } from './entities/operation-log.entity';
import { OperationLogService } from './services/operation-log.service';
import { OperationLogQueryService } from './services/operation-log-query.service';
import { OperationLogAssembler } from './assembler/operation-log.assembler';
import { OperationLogInterceptor } from './interceptors/operation-log.interceptor';
import { AuditErrorCodeHttpStatus } from './constants/audit-error-codes';

// 注册审计错误码 → HTTP 状态映射。
registerErrorCodeHttpStatus(AuditErrorCodeHttpStatus);

@Module({
  imports: [
    TypeOrmModule.forFeature([OperationLog]),
    LoggerModule,
    QueueModule.registerQueues([QUEUE_NAMES.AUDIT]),
  ],
  providers: [
    OperationLogService,
    OperationLogQueryService,
    OperationLogAssembler,
    OperationLogInterceptor,
  ],
  exports: [
    OperationLogService,
    OperationLogQueryService,
    OperationLogAssembler,
    OperationLogInterceptor,
  ],
})
export class AuditModule {}
