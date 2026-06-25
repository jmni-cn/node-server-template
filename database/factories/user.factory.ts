/**
 * user.factory — 测试用主体工厂（EndUser / AdminUser / UserProfile / UserCredential）。
 *
 * 返回部分实体（DeepPartial），由调用方通过 repository.create+save 落库。
 * 字段随机化复用 @core/common 的 ID 生成器，避免唯一约束冲突。
 *
 * 注意：工厂不依赖 DataSource，纯函数，便于在单元/集成测试中复用。
 * identity 域已拆分为 AdminUser / EndUser，故不再存在 `User` 实体。
 */
import { generateLowercaseUid, generateNumericCode } from '@core/common';
import type { DeepPartial } from 'typeorm';
import {
  AdminUser,
  EndUser,
  UserStatus,
  UserProfile,
  UserCredential,
  Gender,
} from '@domains/identity';

const slug = () => generateLowercaseUid(8);
const digits = () => generateNumericCode(8);

/** 生成一个随机 EndUser 的部分属性。 */
export function endUserFactory(
  overrides: DeepPartial<EndUser> = {},
): DeepPartial<EndUser> {
  const suffix = slug();
  return {
    username: `user_${suffix}`,
    email: `user_${suffix}@example.com`,
    phone: `13${digits()}`,
    nickname: `昵称_${suffix}`,
    status: UserStatus.ACTIVE,
    ...overrides,
  };
}

/** 生成一个随机 AdminUser 的部分属性。 */
export function adminUserFactory(
  overrides: DeepPartial<AdminUser> = {},
): DeepPartial<AdminUser> {
  const suffix = slug();
  return {
    username: `admin_${suffix}`,
    email: `admin_${suffix}@example.com`,
    nickname: `管理员_${suffix}`,
    status: UserStatus.ACTIVE,
    ...overrides,
  };
}

/** 生成一个随机 UserProfile 的部分属性（需提供 userId）。 */
export function makeUserProfile(
  userId: string,
  overrides: DeepPartial<UserProfile> = {},
): DeepPartial<UserProfile> {
  return {
    userId,
    nickname: `昵称_${slug()}`,
    gender: Gender.UNKNOWN,
    bio: null,
    ...overrides,
  };
}

/**
 * 生成一个随机 UserCredential 的部分属性（需提供 userId 与已哈希密码）。
 * 测试中通常注入预先用 bcryptjs 计算好的哈希，工厂不做哈希以保持纯函数。
 */
export function makeUserCredential(
  userId: string,
  passwordHash: string,
  overrides: DeepPartial<UserCredential> = {},
): DeepPartial<UserCredential> {
  return {
    userId,
    passwordHash,
    passwordUpdatedAt: new Date(),
    ...overrides,
  };
}
