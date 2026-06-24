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
import type { LinkExternalIdentityInput } from '../types';
import type { SubjectType } from '../types/subject-type';
import { IdentityErrorCode } from '../constants/identity-error-codes';

@Injectable()
export class ExternalIdentityService {
  constructor(
    @InjectRepository(ExternalIdentity)
    private readonly externalIdentityRepository: Repository<ExternalIdentity>,
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
   * - 若该 subjectType+provider+providerUserId 已绑定到其他主体 →
   *   抛 USER_EXTERNAL_IDENTITY_LINKED；
   * - 若已绑定到同一主体 → 直接返回现有记录；
   * - 否则创建新绑定。
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
    return this.externalIdentityRepository.save(identity);
  }

  /** 解绑外部身份（不存在或不属于该主体抛 USER_EXTERNAL_IDENTITY_NOT_FOUND）。 */
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
    await this.externalIdentityRepository.softRemove(identity);
  }
}
