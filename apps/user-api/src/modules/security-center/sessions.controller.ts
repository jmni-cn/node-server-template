import { Controller, Delete, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiArrayResponse, ApiSuccessResponse } from '@core/common';
import { CurrentUser, type UserAuthUser } from '@platform/auth';
import { OperationLogDecorator } from '@platform/audit';
import { SessionService, SessionVo } from '@domains/identity';

/** 用户端安全中心 - 会话管理。控制器仅做委托，业务在 SessionService。 */
@ApiTags('安全中心')
@ApiBearerAuth('bearer')
@Controller('users/me/security/sessions')
export class SessionsController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  @ApiOperation({ summary: '当前用户的活跃会话列表' })
  @ApiArrayResponse(SessionVo)
  list(@CurrentUser() user: UserAuthUser): Promise<SessionVo[]> {
    // 传入当前请求的 jti，列表中标记 current 标志。
    return this.sessionService.listActiveByUser('user', user.sub, user.jti);
  }

  @Delete(':uid')
  @ApiOperation({ summary: '吊销指定会话' })
  @OperationLogDecorator({ action: 'REVOKE_SESSION', module: 'SecurityCenter' })
  @ApiSuccessResponse()
  revoke(
    @CurrentUser() user: UserAuthUser,
    @Param('uid') uid: string,
  ): Promise<void> {
    // 吊销 + 记录 SESSION_REVOKED 安全事件由领域服务内聚完成。
    return this.sessionService.revokeByUser('user', user.sub, uid);
  }
}
