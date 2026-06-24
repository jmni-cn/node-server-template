import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class AssignPermissionsDto {
  @ApiProperty({ description: '权限 UID 列表', type: [String] })
  @IsArray()
  @IsString({ each: true })
  permissionUids: string[];
}
