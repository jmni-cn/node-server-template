import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

/** 登录入参。 */
export class LoginDto {
  @ApiProperty({ description: '登录标识（用户名或邮箱）' })
  @IsString()
  identifier: string;

  @ApiProperty({ description: '明文密码' })
  @IsString()
  password: string;

  @ApiPropertyOptional({
    description: '记住我（延长 access/refresh 令牌有效期）',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  remember?: boolean;
}
