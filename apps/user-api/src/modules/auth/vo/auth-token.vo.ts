import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 令牌响应 VO。
 *
 * Refresh Token 通过 HttpOnly Cookie 下发，不出现在响应体中，
 * `refreshToken` 字段仅为向后兼容保留（默认不返回）。
 */
export class AuthTokenVo {
  @ApiProperty({ description: 'Access Token (JWT)' })
  accessToken: string;

  @ApiPropertyOptional({
    description: 'Refresh Token (JWT)，已改为 HttpOnly Cookie 下发，通常为空',
  })
  refreshToken?: string;

  @ApiProperty({ description: 'Token 类型', example: 'Bearer' })
  tokenType: string;
}
