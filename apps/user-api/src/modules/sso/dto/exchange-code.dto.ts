import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * 一次性登录码换取令牌 DTO。
 *
 * SSO 回调以重定向/响应体下发一次性 `code`（不含任何令牌）；前端凭该 code 调用
 * `POST /sso/exchange` 换取 access token，并由服务端写入 Refresh Token HttpOnly Cookie。
 * code 由 SsoLoginCodeService 生成，短 TTL（默认 60s），仅可使用一次。
 */
export class ExchangeCodeDto {
  @ApiProperty({
    description: '一次性登录码（SSO 回调下发）',
    example: 'a1b2c3d4e5f6...',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
