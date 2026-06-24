import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ description: '权限编码（唯一）', example: 'rbac:user:read' })
  @IsString()
  @MaxLength(128)
  code: string;

  @ApiProperty({ description: '权限名称', example: '查看用户' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: '权限分组', default: 'default' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  group?: string;
}
