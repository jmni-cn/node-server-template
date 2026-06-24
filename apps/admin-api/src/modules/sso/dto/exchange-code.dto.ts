import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * 一次性登录码换取令牌 DTO（管理后台）。
 *
 * 管理端 SSO 回调下发一次性 `code`（不含令牌）；前端凭 code 调用
 * `POST /admin/sso/exchange` 换取令牌。code 短 TTL（默认 60s）且仅可使用一次。
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
