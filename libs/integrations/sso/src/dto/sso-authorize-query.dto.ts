import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * 发起授权跳转的查询参数。
 */
export class SsoAuthorizeQueryDto {
  @ApiPropertyOptional({
    description: '覆盖默认回调地址（需在 IdP 白名单内）',
    example: 'https://app.example.com/auth/sso/callback',
  })
  @IsOptional()
  @IsString()
  redirectUri?: string;
}
