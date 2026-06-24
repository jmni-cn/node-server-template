import { Injectable } from '@nestjs/common';
import { SsoProviderService } from './sso-provider.service';
import { SsoStateService } from './sso-state.service';

/**
 * 生成授权跳转。
 *
 * state 的持久化与回调校验由 {@link SsoStateService} 负责（写入 Redis，TTL 600s，
 * 一次性消费），用于防 CSRF。本服务在授权阶段签发 state 并把 redirectUri 绑定到
 * 该 state，回调阶段由 {@link SsoCallbackService} 校验并取回绑定的 redirectUri。
 */
@Injectable()
export class SsoAuthorizeService {
  constructor(
    private readonly providerService: SsoProviderService,
    private readonly stateService: SsoStateService,
  ) {}

  /**
   * 构建授权跳转地址：签发并持久化 state（绑定 redirectUri），返回 URL 与 state。
   */
  async buildAuthorizeRedirect(
    provider: string,
    opts?: { redirectUri?: string },
  ): Promise<{ url: string; state: string }> {
    const adapter = this.providerService.resolve(provider);
    const state = await this.stateService.issue(provider, {
      redirectUri: opts?.redirectUri,
    });
    const url = adapter.buildAuthorizeUrl(state, opts?.redirectUri);
    return { url, state };
  }
}
