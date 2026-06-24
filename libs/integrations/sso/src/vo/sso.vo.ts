import { ApiProperty } from '@nestjs/swagger';

/**
 * 授权跳转结果。
 */
export class SsoAuthorizeVo {
  @ApiProperty({ description: 'IdP 授权跳转 URL' })
  url!: string;

  @ApiProperty({
    description: '本次授权的 state（应用层应持久化并在回调时校验）',
  })
  state!: string;
}

/**
 * SSO 登录结果。
 */
export class SsoLoginResultVo {
  @ApiProperty({ description: '用户 UID' })
  userUid!: string;

  @ApiProperty({ description: '用户名' })
  username!: string;

  @ApiProperty({ description: '是否为本次新开户用户' })
  isNewUser!: boolean;
}
