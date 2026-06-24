import { Module } from '@nestjs/common';
import { AuditModule } from '@platform/audit';
import { OperationLogsController } from './operation-logs.controller';

/** 管理后台审计模块：操作日志查询。 */
@Module({
  imports: [AuditModule],
  controllers: [OperationLogsController],
})
export class AdminAuditModule {}
