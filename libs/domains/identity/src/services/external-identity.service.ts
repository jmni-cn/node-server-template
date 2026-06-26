/**
 * ExternalIdentityService — 第三方身份服务（subjectType 感知）。
 *
 * 负责外部身份（OAuth/SSO）的查询、绑定与解绑，按 (subjectType, userId) 归属。
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '@core/common';
import { ExternalIdentity } from '../entities/external-identity.entity';
import { ExternalIdentityVo } from '../vo/external-identity.vo';
import { ExternalIdentityMapper } from '../mapper/external-identity.mapper';
import { CredentialService } from './credential.service';
import { SecurityEventService } from './security-event.service';
import type { LinkExternalIdentityInput } from '../types';
import type { SubjectType } from '../types/subject-type';
import { IdentityErrorCode } from '../constants/identity-error-codes';

@Injectable()
export class ExternalIdentityService {
  constructor(
    @InjectRepository(ExternalIdentity)
    private readonly externalIdentityRepository: Repository<ExternalIdentity>,
    private readonly credentialService: CredentialService,
    private readonly securityEventService: SecurityEventService,
  ) {}

  /** 按 subjectType + provider + providerUserId 查询（不存在返回 null）。 */
  async findByProvider(
    subjectType: SubjectType,
    provider: string,
    providerUserId: string,
  ): Promise<ExternalIdentity | null> {
    return this.externalIdentityRepository.findOne({
      where: { subjectType, provider, providerUserId },
    });
  }

  /** 列举某主体的全部外部身份。 */
  async listByUser(
    subjectType: SubjectType,
    userId: string,
  ): Promise<ExternalIdentityVo[]> {
    const identities = await this.externalIdentityRepository.find({
      where: { subjectType, userId },
      order: { id: 'DESC' },
    });
    return ExternalIdentityMapper.toVoArray(identities);
  }

  /**
   * 绑定外部身份。
   *
   * 【安全要求】`input.providerUserId` 必须来自**已验证的 OAuth/OIDC 回调**
   * （由 integrations/sso 的回调服务解析 provider 返回的用户信息后传入），
   * **严禁**直接信任来自客户端请求体的 providerUserId——否则攻击者可伪造
   * 任意 provider 账号完成绑定 / 账号接管。控制器层不得把请求体的 providerUserId
   * 透传到此处。
   *
   * - 若该 subjectType+provider+providerUserId 已绑定到其他主体 →
   *   抛 USER_EXTERNAL_IDENTITY_LINKED；
   * - 若已绑定到同一主体 → 直接返回现有记录；
   * - 否则创建新绑定并记录 EXTERNAL_IDENTITY_LINKED 安全事件（绑定动作审计）。
   */
  async link(input: LinkExternalIdentityInput): Promise<ExternalIdentity> {
    const existing = await this.findByProvider(
      input.subjectType,
      input.provider,
      input.providerUserId,
    );
    if (existing) {
      if (existing.userId !== input.userId) {
        throw new BusinessException(
          IdentityErrorCode.USER_EXTERNAL_IDENTITY_LINKED,
        );
      }
      // 已绑定到同一主体：若本次提供了 providerNickname 快照则刷新后返回。
      if (input.providerNickname !== undefined) {
        existing.providerNickname = input.providerNickname ?? null;
        return this.externalIdentityRepository.save(existing);
      }
      return existing;
    }

    const identity = this.externalIdentityRepository.create({
      subjectType: input.subjectType,
      userId: input.userId,
      provider: input.provider,
      providerUserId: input.providerUserId,
      unionId: input.unionId ?? null,
      providerNickname: input.providerNickname ?? null,
      raw: input.raw ?? null,
    });
    const saved = await this.externalIdentityRepository.save(identity);

    // 记录绑定安全事件（外部身份新增）。
    await this.securityEventService.record({
      subjectType: input.subjectType,
      userId: input.userId,
      eventType: 'EXTERNAL_IDENTITY_LINKED',
      riskLevel: 'medium',
      metadata: {
        action: 'external_identity_linked',
        provider: input.provider,
        externalIdentityUid: saved.uid,
      },
    });

    return saved;
  }

  /**
   * 解绑外部身份。
   *
   * 先校验归属（不存在或不属于该主体抛 USER_EXTERNAL_IDENTITY_NOT_FOUND），
   * 再校验「剩余登录方式」：若解绑后该主体既无密码凭证、也无其它外部身份，
   * 则会变成无任何可用登录方式（账号失联），抛 CANNOT_UNLINK_LAST_LOGIN_METHOD。
   * 解绑成功记录 EXTERNAL_IDENTITY_UNLINKED 安全事件。
   */
  async unlink(
    subjectType: SubjectType,
    userId: string,
    uid: string,
  ): Promise<void> {
    const identity = await this.externalIdentityRepository.findOne({
      where: { uid, subjectType, userId },
    });
    if (!identity) {
      throw new BusinessException(
        IdentityErrorCode.USER_EXTERNAL_IDENTITY_NOT_FOUND,
      );
    }

    // 剩余登录方式校验：避免解绑后主体失去全部登录途径。
    const hasPassword = await this.credentialService.exists(
      subjectType,
      userId,
    );
    if (!hasPassword) {
      const otherIdentityCount = await this.externalIdentityRepository.count({
        where: { subjectType, userId },
      });
      // otherIdentityCount 含当前这一条；<=1 表示解绑后将无任何外部身份。
      if (otherIdentityCount <= 1) {
        throw new BusinessException(
          IdentityErrorCode.CANNOT_UNLINK_LAST_LOGIN_METHOD,
        );
      }
    }

    await this.externalIdentityRepository.softRemove(identity);

    await this.securityEventService.record({
      subjectType,
      userId,
      eventType: 'EXTERNAL_IDENTITY_UNLINKED',
      riskLevel: 'high',
      metadata: {
        action: 'external_identity_unlinked',
        provider: identity.provider,
        externalIdentityUid: uid,
      },
    });
  }
}
