/**
 * @platform/audit — 操作日志（审计）库。
 *
 * 提供操作日志实体、写入/查询服务、组装器、纯映射器、VO/DTO、
 * 拦截器与 @OperationLogDecorator 装饰器。
 *
 * 注意：实体类与装饰器在源文件中都名为 `OperationLog`，为避免公开导出冲突，
 * 实体保持 `OperationLog`，装饰器在此重命名导出为 `OperationLogDecorator`。
 */

export * from './audit.module';

// 实体（导出 OperationLog 实体类）
export * from './entities';

// 服务
export * from './services';

// 组装器与映射器
export * from './assembler';
export * from './mapper';

// VO / DTO / 类型 / 常量
export * from './vo';
export * from './dto';
export * from './types';
export * from './constants';

// 拦截器
export * from './interceptors';

// 装饰器：重命名 OperationLog -> OperationLogDecorator 以避开实体类同名冲突。
export {
  OPERATION_LOG_KEY,
  OperationLog as OperationLogDecorator,
} from './decorators/operation-log-meta.decorator';
export type { OperationLogMetadata } from './decorators/operation-log-meta.decorator';
