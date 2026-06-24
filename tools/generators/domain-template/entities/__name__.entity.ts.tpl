import { Column, Entity } from 'typeorm';
import { BaseEntity } from '@core/database';

/**
 * __Name__ Entity。
 *
 * 继承 BaseEntity（id/uid/时间戳/软删除/审计列）。
 * 必须设置 uidPrefix；schema 变更通过 database/migrations 管理（synchronize:false）。
 */
@Entity('__name__s')
export class __Name__ extends BaseEntity {
  static override uidPrefix = '__name__';

  @Column({ type: 'varchar', length: 100, comment: '名称' })
  name: string;
}
