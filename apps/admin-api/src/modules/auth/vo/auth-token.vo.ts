import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 令牌响应 VO。 */
export class AuthTokenVo {
  @ApiProperty({ description: 'Access Token (JWT)' })
  accessToken: string;

  @ApiPropertyOptional({
    description:
      'Refresh Token (JWT)。默认通过 HttpOnly Cookie 下发，故响应体中可选/缺省。',
  })
  refreshToken?: string;

  @ApiProperty({ description: 'Token 类型', example: 'Bearer' })
  tokenType: string;
}
