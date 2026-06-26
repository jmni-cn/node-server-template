import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * 发起授权跳转的查询参数。
 */
export class SsoAuthorizeQueryDto {
  /**
   * @deprecated 已忽略。出于防 open-redirect，回调地址强制使用各 provider 配置的固定
   * callbackUrl，不再接受客户端传入。保留字段仅为向后兼容旧客户端，传入不生效。
   */
  @ApiPropertyOptional({
    description: '[已废弃，传入将被忽略] 回调地址强制使用服务端配置的固定值',
    deprecated: true,
    example: 'https://app.example.com/auth/sso/callback',
  })
  @IsOptional()
  @IsString()
  redirectUri?: string;
}
