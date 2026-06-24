import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiBaseResponse } from '@core/common';
import { CurrentUser, type UserAuthUser } from '@platform/auth';
import { OperationLogDecorator } from '@platform/audit';
import {
  ProfileService,
  UpdateProfileDto,
  EndUserDetailVo,
  UserProfileVo,
} from '@domains/identity';

/** 用户端个人资料控制器。 */
@ApiTags('个人资料')
@ApiBearerAuth('bearer')
@Controller('users/me')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: '当前用户详情（含资料）' })
  @ApiBaseResponse(EndUserDetailVo)
  me(@CurrentUser() user: UserAuthUser): Promise<EndUserDetailVo> {
    return this.profileService.getDetail(user.sub);
  }

  @Get('profile')
  @ApiOperation({ summary: '当前用户资料' })
  @ApiBaseResponse(UserProfileVo)
  getProfile(@CurrentUser() user: UserAuthUser): Promise<UserProfileVo> {
    return this.profileService.getVo(user.sub);
  }

  @Put('profile')
  @ApiOperation({ summary: '更新当前用户资料' })
  @OperationLogDecorator({ action: 'UPDATE_PROFILE', module: 'Profile' })
  @ApiBaseResponse(UserProfileVo)
  updateProfile(
    @CurrentUser() user: UserAuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileVo> {
    return this.profileService.update(user.sub, dto);
  }
}
