import { Injectable } from '@nestjs/common';
import { BusinessException, generateSecureToken } from '@core/common';
import { CacheService } from '@platform/cache';
import { SsoErrorCode } from '../constants';

/** state 在缓存中的命名空间。 */
const SSO_STATE_NAMESPACE = 'sso:state';

/** state 默认有效期（秒）。 */
const SSO_STATE_TTL_SECONDS = 600;

/**
 * 授权意图：
 * - `'login'`（默认）：回调走原有「登录 / 自动开户」编排；
 * - `'bind'`：回调把经验证的外部身份**绑定到已登录主体**，不创建会话、不登录。
 */
export type SsoAuthorizeIntent = 'login' | 'bind';

/** 与 state 绑定的载荷（授权时写入，回调时取回）。 */
export interface SsoStatePayload {
  /**
   * 授权阶段绑定的 redirectUri（回调换取 token 时复用，忽略客户端传入值）。
   *
   * 出于防 open-redirect，授权阶段写入的应是 provider 配置的固定 callbackUrl，
   * 而非客户端任意传入值（由 authorize service 强制）。
   */
  redirectUri?: string;
  /**
   * 授权意图（缺省视为 `'login'`）。`'bind'` 时回调把外部身份绑定到 {@link bindUserId}
   * 指向的已登录主体，而非登录/开户。意图随机一次性 state 绑定（服务端持有），
   * 客户端无法篡改。
   */
  intent?: SsoAuthorizeIntent;
  /** 绑定意图（intent==='bind'）下，发起绑定的已登录主体类型。 */
  bindSubjectType?: 'admin' | 'user';
  /** 绑定意图（intent==='bind'）下，发起绑定的已登录主体 UID。 */
  bindUserId?: string;
  /**
   * OIDC nonce（防重放）：授权阶段随机生成并随 authorize URL 发送，
   * 回调阶段用于校验 id_token 的 nonce 声明。
   */
  nonce?: string;
  /**
   * PKCE code_verifier（仅服务端持有，绑定到 state）：授权阶段生成，
   * authorize URL 仅携带其 S256 challenge；回调阶段用 verifier 换 token。
   */
  codeVerifier?: string;
}

/**
 * SsoStateService — SSO `state` 防 CSRF 服务。
 *
 * 授权阶段 {@link issue} 生成一次性随机 state，并把绑定载荷（如 redirectUri）写入
 * Redis（命名空间 `sso:state`，TTL 600s）；回调阶段 {@link consume} 校验 state
 * 是否存在并立即删除（一次性使用），缺失/不匹配抛 `SSO_STATE_MISMATCH`。
 *
 * 作为 integration 服务，可依赖 @core/* 与 @platform/*（CacheService）。
 */
@Injectable()
export class SsoStateService {
  constructor(private readonly cache: CacheService) {}

  /**
   * 签发一次性 state，并把载荷写入缓存（TTL 600s），返回 state。
   */
  async issue(provider: string, payload: SsoStatePayload): Promise<string> {
    const state = generateSecureToken();
    await this.cache.set(
      this.key(provider, state),
      payload,
      SSO_STATE_TTL_SECONDS,
      SSO_STATE_NAMESPACE,
    );
    return state;
  }

  /**
   * 原子校验并消费 state（一次性，防重放）：
   * - state 缺失或缓存未命中 → 抛 `SSO_STATE_MISMATCH`；
   * - 命中即原子删除（GETDEL / Lua），返回授权阶段绑定的载荷。
   *
   * 使用 {@link CacheService.getAndDel}（底层原子 GETDEL）替代「get 后 del」两步，
   * 杜绝并发回调下同一 state 被消费两次的竞态。
   */
  async consume(
    provider: string,
    state: string | undefined,
  ): Promise<SsoStatePayload> {
    if (!state) {
      throw new BusinessException(SsoErrorCode.SSO_STATE_MISMATCH);
    }
    const key = this.key(provider, state);
    // 一次性原子消费：读取即失效，防重放。
    const payload = await this.cache.getAndDel<SsoStatePayload>(
      key,
      SSO_STATE_NAMESPACE,
    );
    if (payload === null) {
      throw new BusinessException(SsoErrorCode.SSO_STATE_MISMATCH);
    }
    return payload;
  }

  private key(provider: string, state: string): string {
    return `${provider}:${state}`;
  }
}
