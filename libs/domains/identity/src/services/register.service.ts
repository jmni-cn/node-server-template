/**
 * RegisterService — 终端用户注册服务（END-ONLY）。
 *
 * 编排终端用户创建、密码凭证写入、资料初始化，并发布 USER_REGISTERED 领域事件。
 * 凭证写入委托 CredentialService（subjectType='user'）。
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueueProducer, QUEUE_NAMES, JOB_NAMES } from '@platform/queue';
import type { UserEventJobData } from '@platform/queue';
import { PasswordPolicyService } from '@platform/security';
import { EndUser } from '../entities/end-user.entity';
import { UserProfile } from '../entities/user-profile.entity';
import { RegisterDto } from '../dto/register.dto';
import { EndUserService } from './end-user.service';
import { CredentialService } from './credential.service';

const SUBJECT = 'user' as const;

@Injectable()
export class RegisterService {
  constructor(
    private readonly endUserService: EndUserService,
    private readonly credentialService: CredentialService,
    private readonly queueProducer: QueueProducer,
    private readonly passwordPolicy: PasswordPolicyService,
    @InjectRepository(UserProfile)
    private readonly profileRepository: Repository<UserProfile>,
  ) {}

  /**
   * 注册终端用户：创建 EndUser + 写入密码凭证 + 初始化资料 + 发布注册事件。
   * 返回 EndUser 实体。
   */
  async register(dto: RegisterDto): Promise<EndUser> {
    return this.create({
      username: dto.username,
      email: dto.email,
      phone: dto.phone,
      password: dto.password,
      nickname: dto.nickname ?? null,
    });
  }

  /**
   * SSO 内部开户：由第三方资料初始化 EndUser。
   *
   * 与公开 `register` 共用同一开户编排，并以 `nickname` 初始化展示昵称 / 资料昵称
   * （provider 昵称快照已迁移至 ExternalIdentity.providerNickname，不再落 EndUser）。
   */
  async registerFromSso(input: {
    username: string;
    nickname: string | null;
    email?: string;
    password: string;
  }): Promise<EndUser> {
    return this.create({
      username: input.username,
      email: input.email,
      phone: undefined,
      password: input.password,
      nickname: input.nickname,
    });
  }

  /** 共享开户编排：创建 EndUser + 凭证 + 资料 + 发布注册事件。 */
  private async create(input: {
    username: string;
    email?: string;
    phone?: string;
    password: string;
    nickname: string | null;
  }): Promise<EndUser> {
    // 写库前强制密码强度校验（弱密码抛 SEC_PASSWORD_TOO_WEAK）。
    this.passwordPolicy.validate(input.password);

    const user = await this.endUserService.create({
      username: input.username,
      email: input.email,
      phone: input.phone,
      password: input.password,
      nickname: input.nickname ?? undefined,
    });

    await this.credentialService.setPassword(SUBJECT, user.uid, input.password);

    await this.profileRepository.save(
      this.profileRepository.create({
        userId: user.uid,
        nickname: input.nickname,
      }),
    );

    const job: UserEventJobData = { sub: user.uid, username: user.username };
    await this.queueProducer.enqueue(
      QUEUE_NAMES.USER_EVENTS,
      JOB_NAMES.USER_EVENTS.USER_REGISTERED,
      job,
    );

    return user;
  }
}
