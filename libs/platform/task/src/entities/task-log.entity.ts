import { Entity, Column, Index } from 'typeorm';
import { SystemBaseEntity } from '@core/database';

/**
 * 任务日志实体（表 `task_logs`）。
 *
 * 记录任务执行过程中的日志条目。无用户归属，故继承 SystemBaseEntity
 * （createdAt 由父类提供，不在此重复定义）。UID 前缀为 `tasklog`。
 */
@Entity('task_logs')
export class TaskLog extends SystemBaseEntity {
  protected static override uidPrefix = 'tasklog';

  @Index()
  @Column({
    type: 'varchar',
    name: 'task_uid',
    length: 32,
    comment: '关联任务 UID',
  })
  taskUid: string;

  @Column({
    type: 'varchar',
    length: 20,
    comment: "日志级别（'info'|'warn'|'error'）",
  })
  level: string;

  @Column({ type: 'text', comment: '日志内容' })
  message: string;
}
