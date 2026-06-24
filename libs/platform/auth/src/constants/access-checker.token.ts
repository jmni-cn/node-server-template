/**
 * 权限检查端口（Port）。
 *
 * `PermissionsGuard` 依赖该接口判定用户是否拥有所需权限，但本平台库
 * **不**提供实现。具体实现由消费方应用（apps）或 domain 模块提供，
 * 通过依赖注入绑定到 `ACCESS_CHECKER` token：
 *
 * ```typescript
 * {
 *   provide: ACCESS_CHECKER,
 *   useClass: MyRbacAccessChecker, // implements AccessChecker
 * }
 * ```
 *
 * 这样可保持 @platform/auth 不依赖 @domains/*。
 */
export interface AccessChecker {
  /**
   * 判断指定用户是否拥有给定的全部权限。
   *
   * @param userId 用户 UID（即 JWT 的 sub）
   * @param perms  所需权限编码列表
   * @returns 拥有全部权限时返回 true，否则 false
   */
  hasPermissions(userId: string, perms: string[]): Promise<boolean>;
}

/**
 * `AccessChecker` 实现的注入 token（Symbol，避免命名冲突）。
 */
export const ACCESS_CHECKER = Symbol('ACCESS_CHECKER');
