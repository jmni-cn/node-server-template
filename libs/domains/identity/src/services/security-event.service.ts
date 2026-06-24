/**
 * SecurityEventService — 安全事件记录与查询服务（subjectType 感知）。
 *
 * 记录账户安全事件（登录/登出/刷新/盗用检测/改密等），用于审计与风控。
 * 记录失败绝不影响主流程（吞掉异常并记录日志）。IP 脱敏、UA 哈希后落库。
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createPageResult, maskIp, hashUserAgent } from '@core/common';
import type { PageResultVo, PaginationDto } from '@core/common';
import { RequestContextService } from '@core/request-context';
import { SecurityEvent } from '../entities/security-event.entity';
import type {
  SecurityEventType,
  SecurityRiskLevel,
} from '../entities/security-event.entity';
import { SecurityEventVo } from '../vo/security-event.vo';
import { SecurityEventMapper } from '../mapper/security-event.mapper';
import type { SubjectType } from '../types/subject-type';

/** 记录安全事件入参。 */
export interface RecordSecurityEventInput {
  /** 主体类型: admin/user（匿名事件可省略） */
  subjectType?: SubjectType | null;
  userId?: string | null;
  deviceId?: string | null;
  sessionUid?: string | null;
  eventType: SecurityEventType;
  riskLevel?: SecurityRiskLevel;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class SecurityEventService {
  private readonly logger = new Logger(SecurityEventService.name);

  constructor(
    @InjectRepository(SecurityEvent)
    private readonly eventRepository: Repository<SecurityEvent>,
  ) {}

  /**
   * 记录安全事件。记录失败不抛错（仅写日志），避免污染主链路。
   */
  async record(input: RecordSecurityEventInput): Promise<void> {
    try {
      const event = this.eventRepository.create({
        subjectType: input.subjectType ?? null,
        userId: input.userId ?? null,
        deviceId: input.deviceId ?? null,
        sessionUid: input.sessionUid ?? null,
        eventType: input.eventType,
        riskLevel: input.riskLevel ?? 'low',
        // ip / userAgent 未显式传入时，从请求上下文兜底获取，避免调用方层层透传。
        ipMasked: maskIp(input.ip ?? RequestContextService.getIp()),
        userAgentHash: hashUserAgent(
          input.userAgent ?? RequestContextService.getUserAgent(),
        ),
        metadata: input.metadata ?? null,
      });
      await this.eventRepository.save(event);
    } catch (err) {
      this.logger.warn(
        `记录安全事件失败 eventType=${input.eventType}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** 分页查询某主体的安全事件（按时间倒序）。 */
  async listBySubject(
    subjectType: SubjectType,
    userId: string,
    pagination: PaginationDto,
  ): Promise<PageResultVo<SecurityEventVo>> {
    const page = pagination.page ?? 1;
    const pageSize = pagination.pageSize ?? 10;

    const [items, total] = await this.eventRepository.findAndCount({
      where: { subjectType, userId },
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return createPageResult(
      SecurityEventMapper.toVoArray(items),
      total,
      page,
      pageSize,
    );
  }
}
