import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

/** 为管理员分配角色入参（全量替换）。 */
export class AssignAdministratorRolesDto {
  @ApiProperty({ description: '角色 UID 列表', type: [String] })
  @IsArray()
  @IsString({ each: true })
  roleUids: string[];
}
