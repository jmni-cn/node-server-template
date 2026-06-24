import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/** 绑定外部账号入参。 */
export class LinkExternalAccountDto {
  @ApiProperty({ description: '身份提供方', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  provider: string;

  @ApiProperty({ description: '提供方侧用户标识', maxLength: 128 })
  @IsString()
  @MaxLength(128)
  providerUserId: string;

  @ApiPropertyOptional({ description: 'UnionId', maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  unionId?: string;

  @ApiPropertyOptional({ description: '原始资料' })
  @IsOptional()
  @IsObject()
  raw?: Record<string, unknown>;
}
