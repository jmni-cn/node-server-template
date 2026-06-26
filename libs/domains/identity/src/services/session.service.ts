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

import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
import type { ConfigType } from '@nestjs/config';
import { jwtConfig } from '@core/config';
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

/**
 * 单主体最大活跃会话数兜底默认值。
 * 当 jwtConfig 未注入（如孤立单元测试）时使用；正常运行从 jwtConfig.maxActiveSessions 读取。
 * 与 @core/config 的 JWT_DEFAULTS.MAX_ACTIVE_SESSIONS 保持一致。
 */
const DEFAULT_MAX_ACTIVE_SESSIONS = 1;

/** 会话策略兜底默认值（jwtConfig 未注入时使用）。与 JWT_DEFAULTS.SESSION_POLICY 保持一致。 */
const DEFAULT_SESSION_POLICY: 'replace' | 'limit' = 'replace';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
    private readonly securityEventService: SecurityEventService,
    // 配置可选注入：ConfigModule 全局注册时可解析；孤立测试场景回退到默认常量。
    @Optional()
    @Inject(jwtConfig.KEY)
    private readonly jwtCfg?: ConfigType<typeof jwtConfig>,
  ) {}

  /** 单主体最大活跃会话数（<= 0 表示不限制）。 */
  private get maxActiveSessions(): number {
    return this.jwtCfg?.maxActiveSessions ?? DEFAULT_MAX_ACTIVE_SESSIONS;
  }

  /** 会话策略（replace=全局单会话；limit=保留最近 N 个）。 */
  private get sessionPolicy(): 'replace' | 'limit' {
    return this.jwtCfg?.policy ?? DEFAULT_SESSION_POLICY;
  }

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
    const saved = await this.sessionRepository.save(session);

    // 登录建会话后应用会话策略（replace=全局单会话 / limit=最近 N 个）。
    // 注意：仅 create（登录/注册/SSO 登录）路径触发；rotateSession（refresh 轮换）不调用本方法。
    await this.applySessionPolicy(input.subjectType, input.userId, saved.uid);

    return saved;
  }

  /**
   * 应用会话策略（仅登录建会话时调用）。
   * - replace：作废该主体除当前新会话外的全部活跃会话（全局单会话）。
   * - limit：保留最近 maxActiveSessions 个，超出按最旧驱逐。
   */
  private async applySessionPolicy(
    subjectType: SubjectType,
    userId: string,
    currentUid: string,
  ): Promise<void> {
    if (this.sessionPolicy === 'replace') {
      await this.replaceOtherActiveSessions(subjectType, userId, currentUid);
    } else {
      await this.enforceMaxActiveSessions(subjectType, userId);
    }
  }

  /**
   * replace 策略：作废该主体「未撤销且未过期」的其它所有活跃会话，
   * 仅保留当前新建会话（currentUid），撤销原因 'replaced_by_new_login'。
   * 每个被替换会话记一条 SESSION_REVOKED 安全事件。
   */
  private async replaceOtherActiveSessions(
    subjectType: SubjectType,
    userId: string,
    currentUid: string,
  ): Promise<void> {
    const now = new Date();
    const others = await this.sessionRepository.find({
      where: {
        subjectType,
        userId,
        uid: Not(currentUid),
        revokedAt: IsNull(),
        expiresAt: MoreThan(now),
      },
    });
    if (others.length === 0) return;

    for (const s of others) {
      s.revokedAt = now;
      s.revokedReason = 'replaced_by_new_login';
    }
    await this.sessionRepository.save(others);

    for (const s of others) {
      await this.securityEventService.record({
        subjectType,
        userId,
        sessionUid: s.uid,
        eventType: 'SESSION_REVOKED',
        riskLevel: 'low',
        metadata: { reason: 'replaced_by_new_login' },
      });
    }
  }

  /**
   * 并发会话上限控制（limit 策略）。
   *
   * 统计该主体（subjectType + userId）「未撤销且未过期」的活跃会话，
   * 若超过上限 N，则按 createdAt 升序撤销最旧的多余会话
   * （revoke + revokedReason='max_sessions_evicted'），仅保留最近 N 个。
   * 上限 <= 0 表示不限制。
   *
   * 被驱逐的会话另记一条 SESSION_REVOKED 安全事件，便于审计与风控。
   */
  private async enforceMaxActiveSessions(
    subjectType: SubjectType,
    userId: string,
  ): Promise<void> {
    const max = this.maxActiveSessions;
    if (max <= 0) return;

    const now = new Date();
    const activeSessions = await this.sessionRepository.find({
      where: {
        subjectType,
        userId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(now),
      },
      // 最旧的排在前面，便于截取需要驱逐的部分。
      order: { createdAt: 'ASC', id: 'ASC' },
    });

    if (activeSessions.length <= max) return;

    const toEvict = activeSessions.slice(0, activeSessions.length - max);
    for (const evicted of toEvict) {
      evicted.revokedAt = now;
      evicted.revokedReason = 'max_sessions_evicted';
    }
    await this.sessionRepository.save(toEvict);

    // 记录安全事件（record 内部已吞异常，不影响登录主流程）。
    for (const evicted of toEvict) {
      await this.securityEventService.record({
        subjectType,
        userId,
        sessionUid: evicted.uid,
        eventType: 'SESSION_REVOKED',
        riskLevel: 'low',
        metadata: { reason: 'max_sessions_evicted', maxActiveSessions: max },
      });
    }
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
