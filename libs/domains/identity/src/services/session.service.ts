/**
 * SessionService — 会话服务（subjectType 感知）。
 *
 * 负责刷新令牌会话的创建、查询、令牌轮换、撤销、令牌家族盗用检测与活跃会话列举。
 * 所有按主体定位的查询均带 (subjectType, userId) 过滤；会话 UID 全局唯一，
 * 因此按 uid 的操作无需 subjectType。
 *
 * 安全模型：
 * - create：写入 tokenHash（refresh token 明文的 SHA256）+ tokenFamilyId。
 * - rotateSession：旧会话标记 revokedReason='rotated'，在同一 family 内创建新会话，
 *   refreshCount+1。
 * - validateRefreshSession：校验会话存在/未撤销/tokenHash 匹配；若旧 RT 命中一个
 *   已 'rotated' 的会话 => 判定为令牌盗用 => 撤销整条 family + 记录
 *   REFRESH_REUSE_DETECTED（critical）+ 抛 REFRESH_REUSE_DETECTED。
 */

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { BusinessException } from '@core/common';
import { UserSession } from '../entities/user-session.entity';
import { SessionVo } from '../vo/session.vo';
import { SessionMapper } from '../mapper/session.mapper';
import { hashRefreshToken } from '../utils/user-security.util';
import { SecurityEventService } from './security-event.service';
import type {
  CreateSessionInput,
  RotateSessionParams,
  ValidateRefreshSessionParams,
} from '../types';
import type { SubjectType } from '../types/subject-type';
import { IdentityErrorCode } from '../constants/identity-error-codes';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
    private readonly securityEventService: SecurityEventService,
  ) {}

  /** 创建会话（写入 tokenHash + tokenFamilyId；family 缺省自动生成）。 */
  async create(input: CreateSessionInput): Promise<UserSession> {
    const session = this.sessionRepository.create({
      subjectType: input.subjectType,
      userId: input.userId,
      jti: input.jti,
      tokenFamilyId: input.tokenFamilyId ?? randomUUID(),
      tokenHash: input.refreshToken ? hashRefreshToken(input.refreshToken) : '',
      device: input.device ?? null,
      deviceId: input.deviceId ?? null,
      deviceName: input.deviceName ?? null,
      platform: input.platform ?? 'web',
      appVersion: input.appVersion ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      geo: input.geo ?? null,
      meta: input.meta ?? null,
      refreshCount: 0,
      lastSeenAt: new Date(),
      expiresAt: input.expiresAt,
    });
    return this.sessionRepository.save(session);
  }

  /** 按主体 + jti 查询会话（不存在返回 null）。 */
  async findByUserAndJti(
    subjectType: SubjectType,
    userId: string,
    jti: string,
  ): Promise<UserSession | null> {
    return this.sessionRepository.findOne({
      where: { subjectType, userId, jti },
    });
  }

  /** 按会话 UID 查询（不存在抛 USER_SESSION_NOT_FOUND）。会话 UID 全局唯一。 */
  async findByUid(uid: string): Promise<UserSession> {
    const session = await this.sessionRepository.findOne({ where: { uid } });
    if (!session) {
      throw new BusinessException(IdentityErrorCode.USER_SESSION_NOT_FOUND);
    }
    return session;
  }

  /** 吊销指定会话（按 UID，全局唯一）。 */
  async revoke(uid: string, reason = 'user_logout'): Promise<void> {
    const session = await this.findByUid(uid);
    if (session.revokedAt) return;
    session.revokedAt = new Date();
    session.revokedReason = reason;
    await this.sessionRepository.save(session);
  }

  /**
   * 主体主动吊销自己的某个会话（安全中心场景）。
   * 校验主体归属，吊销后记录 SESSION_REVOKED 安全事件。
   * 不归属当前主体则抛 USER_SESSION_NOT_FOUND（避免越权探测）。
   */
  async revokeByUser(
    subjectType: SubjectType,
    userId: string,
    uid: string,
  ): Promise<void> {
    const session = await this.findByUid(uid);
    if (session.subjectType !== subjectType || session.userId !== userId) {
      throw new BusinessException(IdentityErrorCode.USER_SESSION_NOT_FOUND);
    }
    if (!session.revokedAt) {
      session.revokedAt = new Date();
      session.revokedReason = 'session_revoked';
      await this.sessionRepository.save(session);
    }
    await this.securityEventService.record({
      subjectType,
      userId,
      sessionUid: uid,
      eventType: 'SESSION_REVOKED',
      riskLevel: 'medium',
    });
  }

  /** 吊销某主体的全部会话。 */
  async revokeAllForUser(
    subjectType: SubjectType,
    userId: string,
    reason = 'user_logout_all',
  ): Promise<void> {
    await this.sessionRepository.update(
      { subjectType, userId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }

  /**
   * 吊销整条令牌家族（family）。
   * 若会话未携带 family，则回退为撤销该主体的全部会话。
   */
  async revokeTokenFamily(
    subjectType: SubjectType,
    userId: string,
    tokenFamilyId: string | null,
    reason = 'reuse_detected',
  ): Promise<void> {
    if (!tokenFamilyId) {
      await this.revokeAllForUser(subjectType, userId, reason);
      return;
    }
    await this.sessionRepository.update(
      { subjectType, userId, tokenFamilyId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }

  /** 更新最后活跃时间。 */
  async touchSession(
    subjectType: SubjectType,
    userId: string,
    jti: string,
  ): Promise<void> {
    await this.sessionRepository.update(
      { subjectType, userId, jti },
      { lastSeenAt: new Date() },
    );
  }

  /**
   * 令牌轮换：撤销旧会话（reason='rotated'），在同一 family 创建新会话，
   * refreshCount+1，拷贝设备/IP/UA。旧会话不存在返回 null。
   */
  async rotateSession(
    params: RotateSessionParams,
  ): Promise<UserSession | null> {
    const old = await this.findByUserAndJti(
      params.subjectType,
      params.userId,
      params.oldJti,
    );
    if (!old) return null;

    const now = new Date();
    old.revokedAt = now;
    old.revokedReason = 'rotated';
    await this.sessionRepository.save(old);

    const next = this.sessionRepository.create({
      subjectType: old.subjectType,
      userId: old.userId,
      jti: params.newJti,
      tokenFamilyId: old.tokenFamilyId,
      tokenHash: hashRefreshToken(params.newRefreshToken),
      device: old.device,
      deviceId: old.deviceId,
      deviceName: old.deviceName,
      platform: old.platform,
      appVersion: old.appVersion,
      ip: old.ip,
      userAgent: old.userAgent,
      geo: old.geo,
      meta: old.meta,
      refreshCount: old.refreshCount + 1,
      lastSeenAt: now,
      expiresAt: params.newExpiresAt,
    });
    return this.sessionRepository.save(next);
  }

  /**
   * 校验刷新会话；返回有效会话，或抛对应安全异常：
   * - 会话不存在 => SESSION_INVALID
   * - 已撤销且 reason==='rotated' => 判定令牌盗用：撤销整条 family +
   *   记录 REFRESH_REUSE_DETECTED(critical) + 抛 REFRESH_REUSE_DETECTED
   * - 已撤销（其它原因）=> SESSION_INVALID
   * - 已过期 => SESSION_EXPIRED
   * - tokenHash 与入参明文不匹配 => TOKEN_INVALID
   */
  async validateRefreshSession(
    params: ValidateRefreshSessionParams,
  ): Promise<UserSession> {
    const session = await this.findByUserAndJti(
      params.subjectType,
      params.userId,
      params.jti,
    );
    if (!session) {
      throw new BusinessException(IdentityErrorCode.SESSION_INVALID);
    }

    if (session.revokedAt) {
      if (session.revokedReason === 'rotated') {
        // 旧 RT 重放 => 令牌盗用：撤销整条 family 并记录关键事件。
        await this.revokeTokenFamily(
          params.subjectType,
          params.userId,
          session.tokenFamilyId,
          'reuse_detected',
        );
        await this.securityEventService.record({
          subjectType: params.subjectType,
          userId: params.userId,
          sessionUid: session.uid,
          eventType: 'REFRESH_REUSE_DETECTED',
          riskLevel: 'critical',
          ip: session.ip,
          userAgent: session.userAgent,
          metadata: { jti: params.jti, tokenFamilyId: session.tokenFamilyId },
        });
        throw new BusinessException(IdentityErrorCode.REFRESH_REUSE_DETECTED);
      }
      throw new BusinessException(IdentityErrorCode.SESSION_INVALID);
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new BusinessException(IdentityErrorCode.SESSION_EXPIRED);
    }

    if (
      params.rawToken &&
      session.tokenHash &&
      session.tokenHash !== hashRefreshToken(params.rawToken)
    ) {
      throw new BusinessException(IdentityErrorCode.TOKEN_INVALID);
    }

    return session;
  }

  /** 列举某主体的活跃会话（未吊销且未过期）。currentJti 用于标记当前会话。 */
  async listActiveByUser(
    subjectType: SubjectType,
    userId: string,
    currentJti?: string,
  ): Promise<SessionVo[]> {
    const sessions = await this.sessionRepository.find({
      where: {
        subjectType,
        userId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { id: 'DESC' },
    });
    return SessionMapper.toVoArray(sessions, currentJti);
  }
}
