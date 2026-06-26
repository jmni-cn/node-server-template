import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiArrayResponse,
  ApiSuccessResponse,
  BusinessException,
} from '@core/common';
import { CurrentUser, type UserAuthUser } from '@platform/auth';
import { OperationLogDecorator } from '@platform/audit';
import {
  ExternalIdentityService,
  ExternalIdentityVo,
  IdentityErrorCode,
} from '@domains/identity';

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

  /**
   * 绑定外部账号——禁止直接绑定（账号接管风险）。
   *
   * ⚠️ 安全：绝不能信任客户端传入的 providerUserId 直接绑定，否则攻击者可伪造任意
   * provider 账号完成绑定、接管他人外部身份。**正确的绑定路径是「绑定意图」SSO 授权回调**：
   *
   *   1. 已登录用户发起 `GET /sso/:provider/bind/authorize`（需登录，intent=bind）；
   *   2. provider 回调 `GET /sso/:provider/callback`；
   *   3. 由 integrations/sso 的 {@link SsoCallbackService} 校验授权码/state 后解析出
   *      **经验证的** providerUserId，并按 state 中携带的当前用户调用
   *      ExternalIdentityService.link 完成绑定（不登录、不开户）。
   *
   * 因此本端点恒抛 EXTERNAL_LINK_MUST_USE_OAUTH，引导调用方改走
   * `GET /sso/:provider/bind/authorize`。
   */
  @Post()
  @ApiOperation({
    summary: '绑定外部账号（已禁用：请走 GET /sso/:provider/bind/authorize）',
  })
  @OperationLogDecorator({
    action: 'LINK_EXTERNAL_ACCOUNT',
    module: 'SecurityCenter',
  })
  @ApiSuccessResponse()
  link(@CurrentUser() _user: UserAuthUser): never {
    throw new BusinessException(IdentityErrorCode.EXTERNAL_LINK_MUST_USE_OAUTH);
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
