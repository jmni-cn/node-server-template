/**
 * UserStatus — 用户/管理员账户状态枚举（admin_users 与 end_users 共用）。
 */
export enum UserStatus {
  /** 正常 */
  ACTIVE = 'active',
  /** 已禁用 */
  DISABLED = 'disabled',
  /** 已锁定（如风控临时锁定） */
  LOCKED = 'locked',
  /** 已封禁 */
  BANNED = 'banned',
}
