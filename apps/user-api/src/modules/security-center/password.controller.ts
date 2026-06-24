import { Body, Controller, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponse } from '@core/common';
import { CurrentUser, type UserAuthUser } from '@platform/auth';
import { RateLimit, RateLimitGuard } from '@platform/security';
import { UseGuards } from '@nestjs/common';
import { OperationLogDecorator } from '@platform/audit';
import { ChangePasswordDto, ProfileService } from '@domains/identity';

/** 用户端安全中心 - 修改密码。 */
@ApiTags('安全中心')
@ApiBearerAuth('bearer')
@Controller('users/me')
export class PasswordController {
  constructor(private readonly profileService: ProfileService) {}

  @UseGuards(RateLimitGuard)
  @RateLimit({ windowMs: 60_000, max: 5, keyBy: 'user' })
  @Put('password')
  @ApiOperation({ summary: '修改密码' })
  @OperationLogDecorator({
    action: 'CHANGE_PASSWORD',
    module: 'SecurityCenter',
  })
  @ApiSuccessResponse()
  changePassword(
    @CurrentUser() user: UserAuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.profileService.changePassword(user.sub, dto);
  }
}
