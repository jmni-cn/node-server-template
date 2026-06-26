import { Injectable } from '@nestjs/common';
import {
  BusinessException,
  generateSecureToken,
  generateLowercaseUid,
} from '@core/common';
import { LoggerService } from '@core/logger';
import { RuntimeConfigService } from '@platform/config';
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
import { SsoStateService, type SsoStatePayload } from './sso-state.service';
import { OidcSsoProvider } from '../providers';
import { SsoErrorCode, SSO_CONFIG_KEYS } from '../constants';
import type {
  NormalizedProfile,
  SsoTokenSet,
} from '../types/sso-provider.port';

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

/** 登录意图（intent==='login'）回调结果。 */
export interface SsoLoginCallbackResult {
  intent: 'login';
  user: SsoCallbackPrincipal;
  isNewUser: boolean;
}

/** 绑定意图（intent==='bind'）回调结果：仅绑定，不签发会话。 */
export interface SsoBindCallbackResult {
  intent: 'bind';
  /** 被绑定到的已登录主体类型。 */
  subjectType: SubjectType;
  /** 被绑定到的已登录主体 UID。 */
  userId: string;
  provider: string;
  /** 经验证的第三方用户唯一标识。 */
  providerUserId: string;
}

/** 回调结果（登录 / 绑定二选一，按 state.intent 分流）。 */
export type SsoCallbackResult = SsoLoginCallbackResult | SsoBindCallbackResult;

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
    // 运行期配置读取（DB 覆盖 → 代码默认，fail-safe，热更新）。
    private readonly runtimeConfig: RuntimeConfigService,
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
  ): Promise<SsoCallbackResult> {
    const subjectType = opts.subjectType;

    // 1. 原子校验并消费 state（防 CSRF / 重放）。失败记录安全事件后重抛。
    let statePayload: SsoStatePayload;
    try {
      statePayload = await this.stateService.consume(provider, opts.state);
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

    // OIDC provider：用 state 绑定的 PKCE code_verifier 换 token，并按 nonce 校验 id_token。
    // redirectUri 不再来自客户端/state，由 adapter 回退到 provider 配置的固定 callbackUrl
    // （防 open-redirect）。
    let tokenSet: SsoTokenSet;
    if (adapter instanceof OidcSsoProvider) {
      tokenSet = await adapter.exchangeCodeForTokens({
        code,
        codeVerifier: statePayload.codeVerifier,
      });
      if (tokenSet.idToken && statePayload.nonce) {
        // 校验 id_token 签名与 nonce（失败抛错，阻断重放/注入）。
        await adapter.verifyIdToken({
          idToken: tokenSet.idToken,
          nonce: statePayload.nonce,
        });
      }
    } else {
      tokenSet = await adapter.exchangeCode(code);
    }

    const raw = await adapter.fetchUserInfo(tokenSet);
    const profile = this.normalizer.normalize(provider, raw);

    // 绑定意图：把经验证的外部身份绑定到 state 携带的已登录主体，不登录、不开户。
    if (statePayload.intent === 'bind') {
      return this.handleBind(provider, statePayload, profile);
    }

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

    return { intent: 'login', user: principal, isNewUser };
  }

  /**
   * 绑定意图回调处理（intent==='bind'）：
   * - 主体由授权阶段写入 state 的 {@link SsoStatePayload.bindSubjectType} /
   *   {@link SsoStatePayload.bindUserId} 决定（服务端持有，客户端不可篡改）；
   * - 用回调验证得到的 providerUserId 调 ExternalIdentityService.link 绑定到该主体，
   *   link 内部已做「已被他人绑定」校验并记录 EXTERNAL_IDENTITY_LINKED 安全事件；
   * - **不创建会话、不登录、不开户**。
   *
   * 绑定后入队 SSO 资料同步任务（与登录路径一致，异步补全资料快照）。
   */
  private async handleBind(
    provider: string,
    statePayload: SsoStatePayload,
    profile: NormalizedProfile,
  ): Promise<SsoBindCallbackResult> {
    const bindSubjectType = statePayload.bindSubjectType;
    const bindUserId = statePayload.bindUserId;
    // state 由本服务签发，绑定意图必然携带主体；缺失视为状态被篡改/损坏。
    if (!bindSubjectType || !bindUserId) {
      await this.securityEventService.record({
        subjectType: bindSubjectType ?? 'user',
        userId: bindUserId ?? null,
        eventType: 'SSO_STATE_MISMATCH',
        riskLevel: 'high',
        metadata: { provider, reason: 'bind_state_missing_subject' },
      });
      throw new BusinessException(SsoErrorCode.SSO_STATE_MISMATCH);
    }

    // link 内部：已绑定到他人抛 USER_EXTERNAL_IDENTITY_LINKED，
    // 绑定成功记录 EXTERNAL_IDENTITY_LINKED 安全事件（此处不重复记）。
    await this.link(bindSubjectType, bindUserId, profile);

    await this.queueProducer.enqueue(
      QUEUE_NAMES.SSO_SYNC,
      JOB_NAMES.SSO_SYNC.SYNC_PROFILE,
      {
        subjectType: bindSubjectType,
        provider,
        externalId: profile.providerUserId,
        sub: bindUserId,
      } satisfies SsoSyncJobData,
    );

    this.logger.log('SSO callback handled (bind)', {
      provider,
      subjectType: bindSubjectType,
      userUid: bindUserId,
      providerUserId: profile.providerUserId,
    });

    return {
      intent: 'bind',
      subjectType: bindSubjectType,
      userId: bindUserId,
      provider,
      providerUserId: profile.providerUserId,
    };
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

    // 仅当 IdP 已验证邮箱（email_verified===true）才允许按邮箱自动绑定到已有管理员，
    // 否则攻击者可用未验证的同名邮箱劫持账号。
    if (profile.email && profile.emailVerified) {
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

    // 未匹配到已有用户 → 进入自动开户前的策略闸门。
    await this.assertAutoRegisterAllowed(provider, profile);

    const created = await this.registerService.registerFromSso({
      username: this.deriveUsername(profile),
      nickname: profile.nickname,
      email: profile.email ?? undefined,
      // SSO 用户不走密码登录，这里仅生成一个高熵占位密码（加密安全随机）。
      password: generateSecureToken(32),
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

  /**
   * 终端用户 SSO 自动开户策略闸门（仅在未匹配到已有用户时调用）：
   * 1. allow_auto_register=false → 抛 SSO_AUTO_REGISTER_DISABLED；
   * 2. 配置了邮箱域白名单（allowed_email_domains 非空）时：
   *    - 无邮箱，或邮箱域不在白名单 → 抛 SSO_EMAIL_DOMAIN_NOT_ALLOWED。
   * 未配置白名单（默认）时不做域校验，保持兼容。
   *
   * 策略键运行期从 SSO_CONFIG_KEYS.*（DB 覆盖 → 代码默认）解析，可热更新；
   * 默认值由注册表（registerConfigDefinitions）提供，无需在此传入。
   */
  private async assertAutoRegisterAllowed(
    provider: string,
    profile: NormalizedProfile,
  ): Promise<void> {
    const allowAutoRegister = await this.runtimeConfig.getBoolean(
      SSO_CONFIG_KEYS.ALLOW_AUTO_REGISTER,
    );
    if (!allowAutoRegister) {
      this.logger.warn('SSO auto-register disabled, rejecting new user', {
        provider,
        providerUserId: profile.providerUserId,
      });
      throw new BusinessException(SsoErrorCode.SSO_AUTO_REGISTER_DISABLED, {
        provider,
      });
    }

    const allowedDomains = await this.runtimeConfig.getJson<string[]>(
      SSO_CONFIG_KEYS.ALLOWED_EMAIL_DOMAINS,
    );
    if (allowedDomains.length > 0) {
      const domain = profile.email?.split('@')[1]?.toLowerCase() ?? '';
      if (!domain || !allowedDomains.includes(domain)) {
        this.logger.warn('SSO email domain not allowed for auto-register', {
          provider,
          domain: domain || '(none)',
        });
        throw new BusinessException(
          SsoErrorCode.SSO_EMAIL_DOMAIN_NOT_ALLOWED,
          { provider, domain },
        );
      }
    }
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
    const suffix = generateLowercaseUid(6);
    const prefix = sanitized.length > 0 ? sanitized : 'sso';
    return `${prefix}_${suffix}`;
  }
}
