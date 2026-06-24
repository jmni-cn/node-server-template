/**
 * @core/database/entities — 共享实体基础设施。
 *
 * core/database 只提供基类，不包含具体业务实体：
 * - BaseEntity:        通用可变基类（id, uid, created/updated/deleted 时间戳 + createdBy/updatedBy(+username)）
 * - AuditableEntity:   BaseEntity 的语义化别名（强调带用户审计归属）
 * - ImmutableBaseEntity: 不可变记录基类（id, uid, createdAt, createdBy(+username)）
 * - SystemBaseEntity:  系统生成可变基类（id, uid, created/updated/deleted，无用户归属字段）
 *
 * 每个子类必须定义 `protected static uidPrefix`，用于 @BeforeInsert 生成带前缀 UID。
 */

export * from './base.entity';
export * from './auditable.entity';
export * from './immutable-base.entity';
export * from './system-base.entity';
