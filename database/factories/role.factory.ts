/**
 * role.factory — 测试用 Role 工厂。
 *
 * 返回部分实体（DeepPartial），由调用方通过 repository.create+save 落库。
 * code 随机化复用 @core/common 的 ID 生成器，避免唯一约束冲突。
 */
import { generateLowercaseUid } from '@core/common';
import type { DeepPartial } from 'typeorm';
import { Role } from '@domains/access-control';

const slug = () => generateLowercaseUid(8);

/** 生成一个随机 Role 的部分属性。 */
export function makeRole(overrides: DeepPartial<Role> = {}): DeepPartial<Role> {
  const suffix = slug();
  return {
    code: `role_${suffix}`,
    name: `角色_${suffix}`,
    description: '测试角色',
    isSystem: false,
    ...overrides,
  };
}
