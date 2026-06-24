import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * 第三方授权回调参数。
 */
export class SsoCallbackDto {
  @ApiProperty({ description: 'IdP 返回的授权码' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: '发起授权时下发的 state（应用层需校验）' })
  @IsString()
  @IsNotEmpty()
  state!: string;
}
