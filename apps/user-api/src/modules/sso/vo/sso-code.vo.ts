import { ApiProperty } from '@nestjs/swagger';

/**
 * SSO 一次性登录码 VO。
 *
 * 回调返回（或重定向到前端时携带于查询参数）的一次性 code。前端凭此 code 调用
 * `POST /sso/exchange` 换取 access token + Refresh Token Cookie。令牌不在此出现。
 */
export class SsoCodeVo {
  @ApiProperty({ description: '一次性登录码（短 TTL，单次使用）' })
  code!: string;
}
