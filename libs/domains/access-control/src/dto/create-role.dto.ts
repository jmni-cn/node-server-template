import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ description: '角色编码（唯一）', example: 'editor' })
  @IsString()
  @MaxLength(64)
  code: string;

  @ApiProperty({ description: '角色名称', example: '编辑' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: '角色描述' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
