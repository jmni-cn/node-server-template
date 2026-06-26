import { Injectable } from '@nestjs/common';
import { BusinessException } from '@core/common';
import { SsoErrorCode } from '../constants';
import type { NormalizedProfile } from '../types/sso-provider.port';

/**
 * 将不同 provider 的原始 userinfo 归一化为 NormalizedProfile。
 */
@Injectable()
export class ProviderProfileNormalizerService {
  /**
   * 归一化第三方原始资料。
   *
   * - providerUserId: sub ?? id ?? user_id（缺失抛 SSO_PROFILE_INVALID）
   * - email: email
   * - nickname: nickname ?? name ?? preferred_username ?? login
   * - username: preferred_username ?? username ?? email 本地部分
   * - avatar: picture ?? avatar_url ?? avatar
   */
  normalize(provider: string, raw: Record<string, unknown>): NormalizedProfile {
    const idCandidate = raw.sub ?? raw.id ?? raw.user_id;
    if (
      idCandidate === undefined ||
      idCandidate === null ||
      idCandidate === ''
    ) {
      throw new BusinessException(SsoErrorCode.SSO_PROFILE_INVALID, {
        provider,
        reason: 'missing sub/id/user_id',
      });
    }

    const avatar =
      this.asString(raw.picture) ??
      this.asString(raw.avatar_url) ??
      this.asString(raw.avatar);

    const email = this.asString(raw.email);
    // OIDC email_verified 声明：兼容布尔 true 与字符串 'true'（部分 IdP 以字符串返回）。
    const emailVerified =
      raw.email_verified === true || raw.email_verified === 'true';

    const nickname =
      this.asString(raw.nickname) ??
      this.asString(raw.name) ??
      this.asString(raw.preferred_username) ??
      this.asString(raw.login);

    const username =
      this.asString(raw.preferred_username) ??
      this.asString(raw.username) ??
      (email ? email.split('@')[0] : null);

    // idCandidate 已校验非空；sub/id/user_id 在各 IdP 通常为 string 或 number。
    // 用 typeof 收窄（而非类型断言）以同时满足 no-base-to-string 与 no-unnecessary-type-assertion。
    const providerUserId =
      typeof idCandidate === 'string'
        ? idCandidate
        : typeof idCandidate === 'number' || typeof idCandidate === 'bigint'
          ? idCandidate.toString()
          : JSON.stringify(idCandidate);

    return {
      provider,
      providerUserId,
      email,
      emailVerified,
      nickname,
      username,
      avatar,
      raw,
    };
  }

  private asString(value: unknown): string | null {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    return null;
  }
}
