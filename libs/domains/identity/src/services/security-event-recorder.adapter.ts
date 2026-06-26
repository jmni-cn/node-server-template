/**
 * SecurityEventRecorderAdapter — @platform/auth `SECURITY_EVENT_RECORDER` 端口实现。
 *
 * `PermissionsGuard` 在权限拒绝时通过该端口记录 ACCESS_DENIED 安全事件，
 * 但 @platform/auth 不依赖 @domains/identity。此适配器把端口调用委托给
 * identity 域的 {@link SecurityEventService}，由 IdentityModule（@Global）绑定并导出，
 * 使平台层 guard 能在运行时解析到实现。
 *
 * 记录失败由 SecurityEventService 内部吞掉（不抛错），不影响鉴权主链路。
 */

import { Injectable } from '@nestjs/common';
import type { SecurityEventRecorder } from '@platform/auth';
import { SecurityEventService } from './security-event.service';
import type {
  SecurityEventType,
  SecurityRiskLevel,
} from '../entities/security-event.entity';

@Injectable()
export class SecurityEventRecorderAdapter implements SecurityEventRecorder {
  constructor(private readonly securityEventService: SecurityEventService) {}

  async record(
    eventType: string,
    payload: {
      userId?: string | null;
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<void> {
    await this.securityEventService.record({
      // 端口以 string 传入，落库前收敛为安全事件枚举类型。
      eventType: eventType as SecurityEventType,
      // 端口未携带 subjectType（平台层 guard 不区分主体类型），保持 null 避免误标。
      subjectType: null,
      userId: payload.userId ?? null,
      riskLevel: (payload.riskLevel ?? 'medium') as SecurityRiskLevel,
      metadata: payload.metadata ?? null,
    });
  }
}
