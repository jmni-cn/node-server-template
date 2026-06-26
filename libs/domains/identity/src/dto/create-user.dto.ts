import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

/** 创建用户入参。 */
export class CreateUserDto {
  @ApiProperty({ description: '用户名', maxLength: 50 })
  @IsString()
  @Length(1, 50)
  username: string;

  @ApiPropertyOptional({ description: '邮箱', maxLength: 100 })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({ description: '手机号', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ description: '展示昵称', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;

  @ApiProperty({ description: '明文密码', minLength: 8, maxLength: 128 })
  @IsString()
  @Length(8, 128)
  password: string;
}
