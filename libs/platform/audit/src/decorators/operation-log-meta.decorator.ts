/**
 * Operation Log Decorator — 操作日志装饰器。
 *
 * 标注需要记录操作日志的接口处理方法，配合 OperationLogInterceptor 使用。
 *
 * 注意：装饰器在本文件内的本地名称为 `OperationLog`，与实体类 `OperationLog` 同名。
 * 为避免公开导出冲突，根 index.ts 将其重命名导出为 `OperationLogDecorator`。
 *
 * @example
 * ```typescript
 * import { OperationLogDecorator } from '@platform/audit';
 *
 * @Controller('users')
 * export class UsersController {
 *   @Post()
 *   @OperationLogDecorator({ action: 'CREATE_USER', module: 'Users' })
 *   async create() {}
 * }
 * ```
 */

import { SetMetadata } from '@nestjs/common';

export const OPERATION_LOG_KEY = 'operationLog';

/**
 * 操作日志元数据。
 */
export interface OperationLogMetadata {
  /** 操作行为 */
  action: string;
  /** 操作模块 */
  module: string;
  /** 资源标识（可选） */
  resource?: string;
}

/**
 * 操作日志装饰器。
 */
export const OperationLog = (meta: OperationLogMetadata) =>
  SetMetadata(OPERATION_LOG_KEY, meta);
