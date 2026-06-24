/**
 * admin-api e2e 测试夹具。
 *
 * 提供登录入参等可复用的测试数据。真实集成测试需先以种子数据写入一个
 * 拥有 `rbac:*` 权限的管理员账户。
 */
export const adminLoginFixture = {
  identifier: 'admin',
  password: 'admin123456',
};
