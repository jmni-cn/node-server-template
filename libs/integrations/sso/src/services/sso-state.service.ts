import { Injectable } from '@nestjs/common';
import { BusinessException, generateSecureToken } from '@core/common';
import { CacheService } from '@platform/cache';
import { SsoErrorCode } from '../constants';

/** state 在缓存中的命名空间。 */
const SSO_STATE_NAMESPACE = 'sso:state';

/** state 默认有效期（秒）。 */
const SSO_STATE_TTL_SECONDS = 600;

/** 与 state 绑定的载荷（授权时写入，回调时取回）。 */
export interface SsoStatePayload {
  /** 授权阶段绑定的 redirectUri（回调换取 token 时复用，忽略客户端传入值）。 */
  redirectUri?: string;
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
   * 校验并消费 state（一次性）：
   * - state 缺失或缓存未命中 → 抛 `SSO_STATE_MISMATCH`；
   * - 命中后立即删除键，返回授权阶段绑定的载荷。
   */
  async consume(
    provider: string,
    state: string | undefined,
  ): Promise<SsoStatePayload> {
    if (!state) {
      throw new BusinessException(SsoErrorCode.SSO_STATE_MISMATCH);
    }
    const key = this.key(provider, state);
    const payload = await this.cache.get<SsoStatePayload>(
      key,
      SSO_STATE_NAMESPACE,
    );
    if (payload === null) {
      throw new BusinessException(SsoErrorCode.SSO_STATE_MISMATCH);
    }
    // 一次性使用：消费后立即删除，防重放。
    await this.cache.del(key, SSO_STATE_NAMESPACE);
    return payload;
  }

  private key(provider: string, state: string): string {
    return `${provider}:${state}`;
  }
}
