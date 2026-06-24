/**
 * @domains/identity — 类型 barrel。
 */
import type { SubjectType } from './subject-type';
import type { UserStatus } from '../entities/user-status.enum';

export * from './subject-type';

/**
 * 已认证主体的规范化视图。
 *
 * LoginService 校验成功后返回此结构，调用方（apps/auth 层）无需依赖具体的
 * AdminUser / EndUser 实体即可签发令牌。
 */
export interface AuthenticatedPrincipal {
  /** 主体 UID */
  uid: string;
  /** 用户名（EndUser 可能为空） */
  username: string | null;
  /** 密码版本（用于令牌失效判定） */
  passwordVersion: number;
  /** 账户状态 */
  status: UserStatus;
}

/** 创建会话入参。 */
export interface CreateSessionInput {
  /** 主体类型: admin/user */
  subjectType: SubjectType;
  /** 关联主体 UID */
  userId: string;
  /** 刷新令牌标识 */
  jti: string;
  /** 令牌家族 ID（同一登录链路共享；不传则自动生成） */
  tokenFamilyId?: string;
  /** refresh token 明文（落库存其 SHA256） */
  refreshToken?: string;
  device?: string;
  /** 设备唯一标识 */
  deviceId?: string;
  /** 设备名称 */
  deviceName?: string;
  /** 客户端平台（默认 web） */
  platform?: string;
  /** 客户端版本 */
  appVersion?: string;
  ip?: string;
  userAgent?: string;
  /** 地理位置信息 */
  geo?: Record<string, unknown>;
  /** 附加元数据 */
  meta?: Record<string, unknown>;
  /** 过期时间 */
  expiresAt: Date;
}

/** 令牌轮换入参。 */
export interface RotateSessionParams {
  /** 主体类型: admin/user */
  subjectType: SubjectType;
  /** 关联主体 UID */
  userId: string;
  /** 旧会话 jti */
  oldJti: string;
  /** 新会话 jti */
  newJti: string;
  /** 新 refresh token 明文 */
  newRefreshToken: string;
  /** 新会话过期时间 */
  newExpiresAt: Date;
}

/** 校验刷新会话入参。 */
export interface ValidateRefreshSessionParams {
  /** 主体类型: admin/user */
  subjectType: SubjectType;
  /** 关联主体 UID */
  userId: string;
  /** 会话 jti */
  jti: string;
  /** 原始 refresh token（用于哈希比对） */
  rawToken?: string;
}

/** 绑定外部身份入参。 */
export interface LinkExternalIdentityInput {
  /** 主体类型: admin/user */
  subjectType: SubjectType;
  /** 关联主体 UID */
  userId: string;
  provider: string;
  providerUserId: string;
  unionId?: string;
  /** provider 昵称快照（按 provider 绑定维度，可选） */
  providerNickname?: string | null;
  raw?: Record<string, unknown>;
}
