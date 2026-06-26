/**
 * Access Token 会话有效性校验端口（Port）。
 *
 * `AdminJwtStrategy` / `UserJwtStrategy` 在 access token 签名/字段校验通过后，
 * 希望进一步确认令牌对应的「会话 + 用户」当前仍然有效（会话未撤销、用户存在且
 * 状态 ACTIVE、密码版本 pv 未失效）。但 @platform/auth **不**依赖 @domains/*
 * （会话与用户实体在 @domains/identity）。因此通过该端口解耦：由消费方应用（apps）
 * 绑定实现，strategy 仅依赖接口。
 *
 * ```typescript
 * {
 *   provide: ACCESS_SESSION_VALIDATOR,
 *   useExisting: IdentityAccessSessionValidator, // 内部委托 @domains/identity
 * }
 * ```
 *
 * 该端口为**可选依赖**：未绑定时 strategy 跳过会话校验（仅做签名 + 字段校验），
 * 保证向后兼容；绑定后即获得「实时吊销 / 改密失效在途 access token」能力。
 */
export interface AccessSessionValidator {
  /**
   * 校验 access token 对应的会话与用户当前是否有效。
   *
   * 校验失败（会话不存在/已撤销、用户不存在/非 ACTIVE、pv 不匹配）必须抛出
   * 业务异常；校验通过则正常返回。
   *
   * @param input.subjectType 主体类型（admin/user）
   * @param input.sub         用户 UID（JWT sub）
   * @param input.jti         会话 / 令牌标识（JWT jti）
   * @param input.pv          令牌内的密码版本（JWT pv）
   */
  validateAccess(input: {
    subjectType: 'admin' | 'user';
    sub: string;
    jti: string;
    pv: number;
  }): Promise<void>;
}

/**
 * `AccessSessionValidator` 实现的注入 token（Symbol，避免命名冲突）。
 */
export const ACCESS_SESSION_VALIDATOR = Symbol('ACCESS_SESSION_VALIDATOR');
