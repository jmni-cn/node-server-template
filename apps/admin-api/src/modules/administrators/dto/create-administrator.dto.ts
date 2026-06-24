import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

/** 创建管理员入参（含可选初始角色绑定）。 */
export class CreateAdministratorDto {
  @ApiProperty({ description: '用户名', maxLength: 50 })
  @IsString()
  @Length(1, 50)
  username: string;

  @ApiPropertyOptional({ description: '邮箱', maxLength: 255 })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty({ description: '初始明文密码', minLength: 6, maxLength: 128 })
  @IsString()
  @Length(6, 128)
  password: string;

  @ApiPropertyOptional({ description: '初始角色 UID 列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleUids?: string[];
}
