/**
 * @domains/identity — 身份域库。
 *
 * 规范化拆分的用户域：User / UserProfile / UserCredential / UserSession /
 * ExternalIdentity，配套服务（注册、登录、会话、资料、外部身份）、
 * DTO / VO / Mapper / Assembler / 错误码常量。
 *
 * 依赖边界：仅依赖 @core/* 与 @platform/*。
 */
export * from './identity.module';
export * from './identity-security-ports.module';

export * from './entities';
export * from './dto';
export * from './vo';
export * from './mapper';
export * from './assembler';
export * from './services';
export * from './types';
export * from './constants';
export * from './utils';
