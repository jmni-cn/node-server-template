import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SsoProviderService } from './sso-provider.service';
import {
  SsoStateService,
  type SsoAuthorizeIntent,
  type SsoStatePayload,
} from './sso-state.service';
import { OidcSsoProvider } from '../providers';

/**
 * 发起授权的可选参数。
 *
 * - `redirectUri` 被刻意忽略（防 open-redirect），仅为兼容旧签名保留；
 * - `intent==='bind'` 时必须提供 `bindSubjectType` / `bindUserId`（发起绑定的已登录主体），
 *   回调阶段据此把外部身份绑定到该主体，而非登录/开户。
 */
export interface BuildAuthorizeOptions {
  redirectUri?: string;
  intent?: SsoAuthorizeIntent;
  bindSubjectType?: 'admin' | 'user';
  bindUserId?: string;
}

/**
 * 生成授权跳转。
 *
 * state 的持久化与回调校验由 {@link SsoStateService} 负责（写入 Redis，TTL 600s，
 * 原子一次性消费），用于防 CSRF。本服务在授权阶段：
 * - 签发 state，并把 nonce / PKCE code_verifier 绑定到该 state（仅服务端持有）；
 * - **强制使用各 provider 配置的固定 callbackUrl**，忽略客户端传入的 redirectUri
 *   （防 open-redirect）；
 * - 对支持 OIDC 的 provider 走带 nonce/PKCE 的授权 URL。
 *
 * 回调阶段由 {@link SsoCallbackService} 取回绑定值校验 nonce、用 verifier 换 token。
 */
@Injectable()
export class SsoAuthorizeService {
  constructor(
    private readonly providerService: SsoProviderService,
    private readonly stateService: SsoStateService,
  ) {}

  /**
   * 构建授权跳转地址。
   *
   * 安全约束：
   * 1. **不接受客户端传入的 redirectUri**：始终使用 provider 配置的固定 callbackUrl，
   *    避免 open-redirect / token 被重定向到攻击者地址；
   * 2. 始终生成并绑定 nonce；
   * 3. provider 启用 PKCE 时生成 code_verifier 并以 S256 challenge 发往 IdP，
   *    verifier 仅绑定到 state（永不出现在 URL）。
   *
   * @param provider provider 标识。
   * @param opts 授权选项；`intent==='bind'` 时需携带发起绑定的已登录主体。
   * @returns 授权 URL 与 state。
   */
  async buildAuthorizeRedirect(
    provider: string,
    // 入参保留以兼容调用方签名，但 redirectUri 被刻意忽略（防 open-redirect）。
    opts?: BuildAuthorizeOptions,
  ): Promise<{ url: string; state: string }> {
    const adapter = this.providerService.resolve(provider);

    // 绑定意图的载荷（缺省登录意图不写入 intent，回调按 'login' 处理）。
    const intentPayload: Pick<
      SsoStatePayload,
      'intent' | 'bindSubjectType' | 'bindUserId'
    > =
      opts?.intent === 'bind'
        ? {
            intent: 'bind',
            bindSubjectType: opts.bindSubjectType,
            bindUserId: opts.bindUserId,
          }
        : {};

    // 始终生成 nonce；OIDC + PKCE 时附带 code_verifier。
    const nonce = randomBytes(16).toString('base64url');

    if (adapter instanceof OidcSsoProvider) {
      const usePkce = adapter.isPkceEnabled;
      const codeVerifier = usePkce ? adapter.generateCodeVerifier() : undefined;
      const codeChallenge = codeVerifier
        ? adapter.generateCodeChallenge(codeVerifier)
        : undefined;

      const state = await this.stateService.issue(provider, {
        // 不绑定客户端 redirectUri：回调换 token 时回退到 provider 配置的固定值。
        nonce,
        codeVerifier,
        ...intentPayload,
      });

      const url = adapter.buildOidcAuthorizationUrl({
        state,
        nonce,
        codeChallenge,
      });
      return { url, state };
    }

    // 非 OIDC provider：仍绑定 nonce，走端口默认 authorize URL（固定 callbackUrl）。
    const state = await this.stateService.issue(provider, {
      nonce,
      ...intentPayload,
    });
    const url = adapter.buildAuthorizeUrl(state);
    return { url, state };
  }
}
