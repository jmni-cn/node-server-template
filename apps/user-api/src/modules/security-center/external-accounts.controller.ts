import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiArrayResponse, ApiSuccessResponse } from '@core/common';
import { CurrentUser, type UserAuthUser } from '@platform/auth';
import { OperationLogDecorator } from '@platform/audit';
import { ExternalIdentityService, ExternalIdentityVo } from '@domains/identity';

import { LinkExternalAccountDto } from './dto';

/** 用户端安全中心 - 外部账号（SSO 绑定）管理。 */
@ApiTags('安全中心')
@ApiBearerAuth('bearer')
@Controller('users/me/security/external-accounts')
export class ExternalAccountsController {
  constructor(
    private readonly externalIdentityService: ExternalIdentityService,
  ) {}

  @Get()
  @ApiOperation({ summary: '已绑定外部账号列表' })
  @ApiArrayResponse(ExternalIdentityVo)
  list(@CurrentUser() user: UserAuthUser): Promise<ExternalIdentityVo[]> {
    return this.externalIdentityService.listByUser('user', user.sub);
  }

  @Post()
  @ApiOperation({ summary: '绑定外部账号' })
  @OperationLogDecorator({
    action: 'LINK_EXTERNAL_ACCOUNT',
    module: 'SecurityCenter',
  })
  @ApiSuccessResponse()
  async link(
    @CurrentUser() user: UserAuthUser,
    @Body() dto: LinkExternalAccountDto,
  ): Promise<void> {
    await this.externalIdentityService.link({
      subjectType: 'user',
      userId: user.sub,
      provider: dto.provider,
      providerUserId: dto.providerUserId,
      unionId: dto.unionId,
      raw: dto.raw,
    });
  }

  @Delete(':uid')
  @ApiOperation({ summary: '解绑外部账号' })
  @OperationLogDecorator({
    action: 'UNLINK_EXTERNAL_ACCOUNT',
    module: 'SecurityCenter',
  })
  @ApiSuccessResponse()
  unlink(
    @CurrentUser() user: UserAuthUser,
    @Param('uid') uid: string,
  ): Promise<void> {
    return this.externalIdentityService.unlink('user', user.sub, uid);
  }
}
