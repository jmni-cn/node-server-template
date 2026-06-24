import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

/**
 * 事务辅助服务。
 * 封装 DataSource.transaction，提供统一的事务执行入口，
 * 回调内通过传入的 EntityManager 完成所有持久化操作以保证同一事务。
 *
 * @example
 * ```typescript
 * await this.tx.run(async (manager) => {
 *   await manager.save(user);
 *   await manager.save(profile);
 * });
 * ```
 */
@Injectable()
export class TransactionHelper {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 在单个数据库事务中执行回调。
   * 回调抛错时自动回滚，正常返回时提交。
   */
  run<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(work);
  }

  /** 获取底层 DataSource（高级场景使用） */
  getDataSource(): DataSource {
    return this.dataSource;
  }
}
