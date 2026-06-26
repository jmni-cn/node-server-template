/**
 * @core/database — TypeORM (MySQL) 基础设施
 *
 * 提供 DatabaseModule、CLI data-source、共享连接选项工厂、
 * 实体基类（Base/Auditable/Immutable/System）与事务辅助。
 */
export * from './database.module';
export * from './typeorm-options.factory';
export * from './entities';
export * from './subscribers/audit-fields.subscriber';
export * from './transaction';

// CLI 数据源（默认导出供 TypeORM CLI 使用）
export { dataSourceOptions } from './data-source';
export { default as dataSource } from './data-source';
