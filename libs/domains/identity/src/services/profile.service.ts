/**
 * ProfileService — 终端用户资料与密码服务（END-ONLY）。
 *
 * 负责终端用户资料（UserProfile）的查询/更新，以及密码（UserCredential，
 * subjectType='user'）的修改。
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '@core/common';
import { QueueProducer, QUEUE_NAMES, JOB_NAMES } from '@platform/queue';
import type { UserEventJobData } from '@platform/queue';
import { UserProfile } from '../entities/user-profile.entity';
import { UserProfileVo } from '../vo/user-profile.vo';
import { UserProfileMapper } from '../mapper/user-profile.mapper';
import { EndUserDetailVo } from '../vo/end-user.vo';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { EndUserService } from './end-user.service';
import { CredentialService } from './credential.service';
import { SessionService } from './session.service';
import { SecurityEventService } from './security-event.service';
import { IdentityErrorCode } from '../constants/identity-error-codes';

const SUBJECT = 'user' as const;

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(UserProfile)
    private readonly profileRepository: Repository<UserProfile>,
    private readonly queueProducer: QueueProducer,
    private readonly endUserService: EndUserService,
    private readonly credentialService: CredentialService,
    private readonly sessionService: SessionService,
    private readonly securityEventService: SecurityEventService,
  ) {}

  /** 按 EndUser UID 查询资料（不存在返回 null）。 */
  async getByUserId(endUserUid: string): Promise<UserProfile | null> {
    return this.profileRepository.findOne({ where: { userId: endUserUid } });
  }

  /** 按 EndUser UID 查询资料 VO（不存在抛 USER_PROFILE_NOT_FOUND）。 */
  async getVo(endUserUid: string): Promise<UserProfileVo> {
    const profile = await this.getByUserId(endUserUid);
    if (!profile) {
      throw new BusinessException(IdentityErrorCode.USER_PROFILE_NOT_FOUND);
    }
    return UserProfileMapper.toVo(profile);
  }

  /** 查询终端用户详情 VO（含资料）。 */
  async getDetail(endUserUid: string): Promise<EndUserDetailVo> {
    return this.endUserService.getDetail(endUserUid);
  }

  /** 更新终端用户资料（资料不存在抛 USER_PROFILE_NOT_FOUND）。 */
  async update(
    endUserUid: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfileVo> {
    const profile = await this.getByUserId(endUserUid);
    if (!profile) {
      throw new BusinessException(IdentityErrorCode.USER_PROFILE_NOT_FOUND);
    }
    if (dto.nickname !== undefined) profile.nickname = dto.nickname;
    if (dto.avatar !== undefined) profile.avatar = dto.avatar;
    if (dto.gender !== undefined) profile.gender = dto.gender;
    if (dto.bio !== undefined) profile.bio = dto.bio;
    const saved = await this.profileRepository.save(profile);
    return UserProfileMapper.toVo(saved);
  }

  /**
   * 修改终端用户密码：校验旧密码 → 写新密码 → 递增 pv → 撤销全部会话 →
   * 记录 PASSWORD_CHANGED 安全事件 → 发布 PASSWORD_CHANGED 领域事件。
   */
  async changePassword(
    endUserUid: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const matched = await this.credentialService.verify(
      SUBJECT,
      endUserUid,
      dto.oldPassword,
    );
    if (!matched) {
      throw new BusinessException(IdentityErrorCode.USER_PASSWORD_INCORRECT);
    }
    await this.credentialService.setPassword(
      SUBJECT,
      endUserUid,
      dto.newPassword,
    );

    // 改密后：递增 pv 使旧 token 失效，撤销全部会话，记录安全事件。
    await this.endUserService.incrementPasswordVersion(endUserUid);
    await this.sessionService.revokeAllForUser(
      SUBJECT,
      endUserUid,
      'password_changed',
    );
    await this.securityEventService.record({
      subjectType: SUBJECT,
      userId: endUserUid,
      eventType: 'PASSWORD_CHANGED',
      riskLevel: 'high',
    });

    const job: UserEventJobData = { sub: endUserUid, username: null };
    await this.queueProducer.enqueue(
      QUEUE_NAMES.USER_EVENTS,
      JOB_NAMES.USER_EVENTS.PASSWORD_CHANGED,
      job,
    );
  }
}
