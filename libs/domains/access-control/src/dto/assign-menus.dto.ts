import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class AssignMenusDto {
  @ApiProperty({ description: '菜单 UID 列表', type: [String] })
  @IsArray()
  @IsString({ each: true })
  menuUids: string[];
}
