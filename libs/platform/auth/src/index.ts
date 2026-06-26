/**
 * @platform/auth — 平台认证基础设施。
 *
 * 提供 JWT 签发 / 校验、Token 黑名单、passport 策略
 * （admin-jwt / user-jwt / refresh-jwt）、认证守卫、RBAC 权限守卫，
 * 以及认证相关的装饰器、类型与错误码。
 *
 * 不依赖 @domains/* / @integrations/* / 任何 app；权限判定通过
 * `ACCESS_CHECKER` 端口由消费方应用注入实现。
 */

// Module
export * from './auth.module';

// Constants（错误码 + ACCESS_CHECKER 端口）
export * from './constants';

// Types
export * from './types';

// Decorators
export * from './decorators';

// Guards
export * from './guards';

// Interceptors
export * from './interceptors';

// Strategies
export * from './strategies';

// Services
export * from './services';

// Utils（JWT 过期解析 / refresh cookie 等纯函数）
export * from './utils';
