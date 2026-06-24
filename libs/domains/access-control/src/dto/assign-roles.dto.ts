import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class AssignRolesDto {
  @ApiProperty({ description: '角色 UID 列表', type: [String] })
  @IsArray()
  @IsString({ each: true })
  roleUids: string[];
}
