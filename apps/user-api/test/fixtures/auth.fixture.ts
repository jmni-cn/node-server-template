/**
 * user-api e2e 测试夹具。
 */
export const registerFixture = {
  username: `u_${Date.now()}`,
  email: `u_${Date.now()}@example.com`,
  password: 'secret123',
  nickname: 'Tester',
};

export const loginFixture = {
  identifier: registerFixture.username,
  password: registerFixture.password,
};
