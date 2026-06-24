import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { BusinessException } from '@core/common';
import { LoggerService } from '@core/logger';
import {
  QueueProducer,
  QUEUE_NAMES,
  JOB_NAMES,
  type SsoSyncJobData,
} from '@platform/queue';
/**
 * 在集成层导入 @domains/identity 是被允许的：架构分层规则中
 * integration 可以依赖 @core/* / @platform/* / @domains/*。
 */
import {
  AdminUserService,
  EndUserService,
  ExternalIdentityService,
  RegisterService,
  SecurityEventService,
  type SubjectType,
} from '@domains/identity';

import { SsoProviderService } from './sso-provider.service';
import { ProviderProfileNormalizerService } from './provider-profile-normalizer.service';
import { SsoStateService } from './sso-state.service';
import { SsoErrorCode } from '../constants';
import type { NormalizedProfile } from '../types/sso-provider.port';

/** 回调返回的规范化登录主体（最小集合，供 app 层重载完整主体）。 */
export interface SsoCallbackPrincipal {
  uid: string;
  username: string | null;
  passwordVersion: number;
}

/** 回调入参（含 subjectType，决定身份域与开户策略）。 */
export interface SsoCallbackOptions {
  state?: string;
  redirectUri?: string;
  subjectType: SubjectType;
}

/**
 * SSO 回调编排（subjectType 感知）：code 换 token → 拉取 userinfo → 归一化 →
 * 身份匹配/绑定/开户 → 入队 SSO 同步任务。
 *
 * subjectType 决定身份域与开户策略：
 * - `user`：在终端用户域（EndUser）匹配；未命中时自动开户（RegisterService）。
 * - `admin`：在管理员域（AdminUser）匹配；**绝不自动开户**，未命中抛
 *   `SSO_ACCOUNT_NOT_FOUND`。
 */
@Injectable()
export class SsoCallbackService {
  constructor(
    private readonly providerService: SsoProviderService,
    private readonly normalizer: ProviderProfileNormalizerService,
    private readonly adminUserService: AdminUserService,
    private readonly endUserService: EndUserService,
    private readonly externalIdentityService: ExternalIdentityService,
    private readonly registerService: RegisterService,
    private readonly stateService: SsoStateService,
    private readonly securityEventService: SecurityEventService,
    private readonly queueProducer: QueueProducer,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(SsoCallbackService.name);
  }

  /**
   * 处理第三方授权回调，返回规范化登录主体与是否为新开户用户。
   *
   * 先校验并消费 `state`（防 CSRF，一次性）：
   * - 校验失败（缺失/未命中）→ 记录 `SSO_STATE_MISMATCH` 安全事件（high）后重抛；
   * - 校验成功 → 使用授权阶段绑定的 redirectUri 做 token 交换（忽略客户端传入的
   *   redirectUri，避免被篡改）。
   *
   * 身份匹配策略（subjectType 决定，二者不共用规则）：
   *
   * admin（绝不自动开户）：
   * 1. ExternalIdentity(admin, provider, providerUserId) 命中 → 直接登录；
   * 2. 否则若有 email 且命中已有管理员 → 绑定外部身份 +（可选）回填
   *    providerNickname 快照 → 登录；
   * 3. 否则 → 抛 `SSO_ACCOUNT_NOT_FOUND`。
   *
   * user（providerUserId 为唯一稳定关联键，不做邮箱匹配/合并）：
   * 1. ExternalIdentity(user, provider, providerUserId) 命中 → 直接登录；
   * 2. 否则 → 由 provider 资料开户新 EndUser（RegisterService.registerFromSso）
   *    并绑定外部身份（isNewUser=true）。
   */
  async handleCallback(
    provider: string,
    code: string,
    opts: SsoCallbackOptions,
  ): Promise<{ user: SsoCallbackPrincipal; isNewUser: boolean }> {
    const subjectType = opts.subjectType;

    // 1. 校验并消费 state（防 CSRF）。失败记录安全事件后重抛。
    let redirectUri: string | undefined;
    try {
      ({ redirectUri } = await this.stateService.consume(provider, opts.state));
    } catch (err) {
      await this.securityEventService.record({
        subjectType,
        userId: null,
        eventType: 'SSO_STATE_MISMATCH',
        riskLevel: 'high',
        metadata: { provider },
      });
      throw err;
    }

    const adapter = this.providerService.resolve(provider);

    const tokenSet = await adapter.exchangeCode(code, redirectUri);
    const raw = await adapter.fetchUserInfo(tokenSet);
    const profile = this.normalizer.normalize(provider, raw);

    const { principal, isNewUser } =
      subjectType === 'admin'
        ? await this.resolveAdmin(provider, profile)
        : await this.resolveUser(provider, profile);

    // 入队 SSO 资料同步任务（异步对账/补全）。
    await this.queueProducer.enqueue(
      QUEUE_NAMES.SSO_SYNC,
      JOB_NAMES.SSO_SYNC.SYNC_PROFILE,
      {
        subjectType,
        provider,
        externalId: profile.providerUserId,
        sub: principal.uid,
      } satisfies SsoSyncJobData,
    );

    this.logger.log('SSO callback handled', {
      provider,
      subjectType,
      userUid: principal.uid,
      isNewUser,
    });

    return { user: principal, isNewUser };
  }

  /**
   * 管理员身份解析（绝不自动开户）。
   * providerUserId 命中 → 登录；否则 email 命中已有管理员 → 绑定+登录；
   * 否则 → SSO_ACCOUNT_NOT_FOUND。
   */
  private async resolveAdmin(
    provider: string,
    profile: NormalizedProfile,
  ): Promise<{ principal: SsoCallbackPrincipal; isNewUser: boolean }> {
    const existing = await this.externalIdentityService.findByProvider(
      'admin',
      provider,
      profile.providerUserId,
    );
    if (existing) {
      const admin = await this.adminUserService.findByUid(existing.userId);
      return { principal: this.toPrincipal(admin), isNewUser: false };
    }

    if (profile.email) {
      const admin = await this.adminUserService.findByEmail(profile.email);
      if (admin) {
        await this.link('admin', admin.uid, profile);
        return { principal: this.toPrincipal(admin), isNewUser: false };
      }
    }

    await this.securityEventService.record({
      subjectType: 'admin',
      userId: null,
      eventType: 'LOGIN_FAILED',
      riskLevel: 'medium',
      metadata: { provider, reason: 'sso_account_not_found' },
    });
    throw new BusinessException(SsoErrorCode.SSO_ACCOUNT_NOT_FOUND, {
      provider,
      providerUserId: profile.providerUserId,
    });
  }

  /**
   * 终端用户身份解析（providerUserId 为唯一稳定关联键）。
   * providerUserId 命中 → 登录；否则由 provider 资料开户新用户 + 绑定。
   * 不做任何邮箱匹配/合并。
   */
  private async resolveUser(
    provider: string,
    profile: NormalizedProfile,
  ): Promise<{ principal: SsoCallbackPrincipal; isNewUser: boolean }> {
    const existing = await this.externalIdentityService.findByProvider(
      'user',
      provider,
      profile.providerUserId,
    );
    if (existing) {
      const user = await this.endUserService.findByUid(existing.userId);
      return { principal: this.toPrincipal(user), isNewUser: false };
    }

    const created = await this.registerService.registerFromSso({
      username: this.deriveUsername(profile),
      nickname: profile.nickname,
      email: profile.email ?? undefined,
      password: randomUUID(),
    });
    await this.link('user', created.uid, profile);
    return {
      principal: {
        uid: created.uid,
        username: created.username,
        passwordVersion: created.passwordVersion,
      },
      isNewUser: true,
    };
  }

  /** 主体实体（含 uid/username/passwordVersion）→ 规范化登录主体。 */
  private toPrincipal(subject: {
    uid: string;
    username: string | null;
    passwordVersion: number;
  }): SsoCallbackPrincipal {
    return {
      uid: subject.uid,
      username: subject.username,
      passwordVersion: subject.passwordVersion,
    };
  }

  /** 绑定外部身份，失败统一抛 SSO_IDENTITY_LINK_FAILED。 */
  private async link(
    subjectType: SubjectType,
    userId: string,
    profile: NormalizedProfile,
  ): Promise<void> {
    try {
      await this.externalIdentityService.link({
        subjectType,
        userId,
        provider: profile.provider,
        providerUserId: profile.providerUserId,
        providerNickname: profile.nickname,
        raw: profile.raw,
      });
    } catch (err) {
      this.logger.error('SSO identity link failed', {
        subjectType,
        userId,
        provider: profile.provider,
        err: String(err),
      });
      throw new BusinessException(SsoErrorCode.SSO_IDENTITY_LINK_FAILED, {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
      });
    }
  }

  /**
   * 由 username/nickname/email/providerUserId 派生唯一 username：以 provider 提供的
   * username 为首选基底，做基础清洗并附短随机后缀避免唯一约束冲突。
   */
  private deriveUsername(profile: NormalizedProfile): string {
    const base =
      profile.username ??
      profile.nickname ??
      (profile.email ? profile.email.split('@')[0] : null) ??
      profile.providerUserId;
    const sanitized = base
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24);
    const suffix = randomUUID().replace(/-/g, '').slice(0, 6);
    const prefix = sanitized.length > 0 ? sanitized : 'sso';
    return `${prefix}_${suffix}`;
  }
}
