/**
 * AuditFieldsSubscriber — 行级操作人审计自动回填订阅器。
 *
 * 在实体 insert / update 时，从请求上下文（RequestContextService）读取当前
 * 登录主体的 sub / username，自动回填到实体的操作人审计列：
 * - insert：createdBy / createdByUsername / updatedBy / updatedByUsername
 * - update：updatedBy / updatedByUsername
 *
 * 设计要点：
 * - 仅对「后台可管理的配置 / RBAC 表」回填（见 AUDITED_TABLES 白名单）。
 *   这些表才需要行级「谁创建/谁最后改」的追溯；会话、安全事件、操作日志、
 *   任务等高频/系统流水表不纳入，避免无谓写入与噪音（其请求级审计由
 *   operation_logs 覆盖）。
 * - 仅当实体在 TypeORM metadata 中真实拥有对应列时才回填，避免污染
 *   不含这些列的实体（如 SystemBaseEntity 派生的 task_logs）。
 * - 上下文无登录用户时（如 worker 异步任务、CLI、seed）保持原值不覆盖，
 *   不报错，从而保留显式赋值或 null。
 * - 覆盖盲区：纯 QueryBuilder / criteria 的 repository.update(...) 不携带实体对象，
 *   订阅器无法回填；此类批量写需在 service 调用点显式从 RequestContext 写入审计字段。
 * - 不接管 created_at / updated_at —— 仍由 @CreateDateColumn /
 *   @UpdateDateColumn 自动管理。
 *
 * 注册方式：作为 NestJS provider 注入（构造时拿到 DataSource 并 subscribe），
 * 见 DatabaseModule。RequestContextService 为 @core 零依赖叶子库，
 * 不依赖 @core/database，故不构成循环依赖。
 */

import { Injectable } from '@nestjs/common';
import {
  DataSource,
  type EntitySubscriberInterface,
  type InsertEvent,
  type UpdateEvent,
  type ObjectLiteral,
} from 'typeorm';
import { RequestContextService } from '@core/request-context';

/**
 * 启用行级操作人审计回填的表（后台可管理的配置 / RBAC 表）。
 * 其它表（会话/安全事件/操作日志/任务/用户资料等）不在此列，不回填。
 * 如需扩展（例如纳入 end_users 的后台用户管理审计），在此追加表名即可。
 */
const AUDITED_TABLES: ReadonlySet<string> = new Set([
  'admin_users',
  'end_users',
  'roles',
  'permissions',
  'menus',
  'dictionaries',
  'dictionary_items',
  'system_configs',
]);

@Injectable()
export class AuditFieldsSubscriber
  implements EntitySubscriberInterface<ObjectLiteral>
{
  constructor(dataSource: DataSource) {
    // 将自身注册到当前 DataSource，使 TypeORM 在写操作时回调本订阅器。
    dataSource.subscribers.push(this);
  }

  /** 该实体对应的表是否在审计白名单内。 */
  private isAudited(event: {
    metadata: { tableName: string };
  }): boolean {
    return AUDITED_TABLES.has(event.metadata.tableName);
  }

  /**
   * 判断给定实体在其 TypeORM metadata 中是否声明了某个实体属性列。
   * 基于 metadata 而非 `in` 运算，避免未赋值属性的误判。
   */
  private hasColumn(event: { metadata: { columns: { propertyName: string }[] } }, propertyName: string): boolean {
    return event.metadata.columns.some((c) => c.propertyName === propertyName);
  }

  /** insert 前：回填创建人 + 更新人（创建即视为首次更新）。 */
  beforeInsert(event: InsertEvent<ObjectLiteral>): void {
    const entity = event.entity;
    if (!entity) return;
    if (!this.isAudited(event)) return;

    const sub = RequestContextService.getSub();
    if (!sub) return; // 无登录上下文（worker/CLI/seed）：保持原值，不覆盖。

    const username = RequestContextService.getUsername() ?? null;

    if (this.hasColumn(event, 'createdBy') && entity.createdBy == null) {
      entity.createdBy = sub;
    }
    if (
      this.hasColumn(event, 'createdByUsername') &&
      entity.createdByUsername == null
    ) {
      entity.createdByUsername = username;
    }
    if (this.hasColumn(event, 'updatedBy') && entity.updatedBy == null) {
      entity.updatedBy = sub;
    }
    if (
      this.hasColumn(event, 'updatedByUsername') &&
      entity.updatedByUsername == null
    ) {
      entity.updatedByUsername = username;
    }
  }

  /** update 前：回填更新人。 */
  beforeUpdate(event: UpdateEvent<ObjectLiteral>): void {
    const entity = event.entity as ObjectLiteral | undefined;
    // 仅在传入实体对象的 save 场景回填；纯 QueryBuilder/criteria update 无 entity。
    if (!entity) return;
    if (!this.isAudited(event)) return;

    const sub = RequestContextService.getSub();
    if (!sub) return;

    const username = RequestContextService.getUsername() ?? null;

    if (this.hasColumn(event, 'updatedBy')) {
      entity.updatedBy = sub;
    }
    if (this.hasColumn(event, 'updatedByUsername')) {
      entity.updatedByUsername = username;
    }
  }
}
