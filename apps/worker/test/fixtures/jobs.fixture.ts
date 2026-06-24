import type { OperationLogJobData, UserEventJobData } from '@platform/queue';

/** worker 集成测试夹具：可复用的 job 负载样例。 */
export const operationLogJobFixture: OperationLogJobData = {
  requestId: 'req_test',
  jti: null,
  sub: 'usr_test',
  username: 'tester',
  action: 'CREATE_USER',
  module: 'Users',
  method: 'POST',
  path: '/admin/users',
  params: null,
  result: null,
  ip: '127.0.0.1',
  userAgent: null,
  deviceType: null,
  browser: null,
  browserVersion: null,
  os: null,
  osVersion: null,
  country: null,
  region: null,
  city: null,
  success: true,
  errorCode: null,
  errorMessage: null,
  duration: 12,
};

export const userRegisteredJobFixture: UserEventJobData = {
  sub: 'usr_test',
  username: 'tester',
};
