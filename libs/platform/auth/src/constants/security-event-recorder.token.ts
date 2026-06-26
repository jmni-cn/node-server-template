/**
 * 安全事件记录端口（Port）。
 *
 * `PermissionsGuard` 在权限拒绝时希望记录一条 ACCESS_DENIED 安全事件，
 * 但 @platform/auth **不**依赖 @domains/*（安全事件实体/服务在 @domains/identity）。
 * 因此通过该端口解耦：由消费方应用（apps）绑定实现，guard 仅依赖接口。
 *
 * ```typescript
 * {
 *   provide: SECURITY_EVENT_RECORDER,
 *   useClass: SecurityEventRecorderAdapter, // 内部委托 @domains/identity 的 SecurityEventService
 * }
 * ```
 *
 * 该端口为可选依赖：未绑定时 guard 不记录安全事件（鉴权逻辑不受影响）。
 */
export interface SecurityEventRecorder {
  /**
   * 记录一条安全事件。实现内部需自行兜底失败，不得抛出。
   *
   * @param eventType 事件类型（如 'ACCESS_DENIED'）
   * @param payload   附加信息（操作人、所需权限、路径等）
   */
  record(
    eventType: string,
    payload: {
      userId?: string | null;
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<void> | void;
}

/**
 * `SecurityEventRecorder` 实现的注入 token（Symbol）。
 */
export const SECURITY_EVENT_RECORDER = Symbol('SECURITY_EVENT_RECORDER');
