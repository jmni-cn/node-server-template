import { BaseEntity } from './base.entity';

/**
 * 可审计实体基类。
 *
 * `BaseEntity` 已内置完整的用户归属审计列（createdBy / updatedBy /
 * createdByUsername / updatedByUsername）以及时间戳与软删除列，
 * 因此 `AuditableEntity` 仅作为语义化别名，强调“带用户审计归属”的实体场景。
 *
 * 系统/定时任务生成、无用户归属的记录请改用 `SystemBaseEntity`。
 *
 * @example
 * ```typescript
 * @Entity('users')
 * export class User extends AuditableEntity {
 *   protected static uidPrefix = 'usr';
 * }
 * ```
 */
export abstract class AuditableEntity extends BaseEntity {}
