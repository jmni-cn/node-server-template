import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigType } from '@nestjs/config';
import { jwtConfig } from '@core/config';
import { ApiBaseResponse, ApiSuccessResponse } from '@core/common';
import {
  CurrentAdminUser,
  Public,
  RefreshJwtAuthGuard,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  type AdminAuthUser,
  type RefreshAuthUser,
} from '@platform/auth';
import { RateLimit, RateLimitGuard } from '@platform/security';
import { OperationLogDecorator } from '@platform/audit';

import { AdminLoginDto } from './dto';
import { AdminAuthService } from './admin-auth.service';
import { AuthTokenVo, AdminProfileVo } from './vo';

/**
 * 管理后台认证控制器。
 *
 * 控制器保持轻薄：跨服务编排（凭证校验、权限读取、令牌签发、会话管理）由
 * {@link AdminAuthService} 负责；控制器仅做请求解析、调用单一应用服务方法、
 * HTTP 传输（与用户端一致，通过 HttpOnly Cookie 下发 Refresh Token）与 VO 映射。
 */
@ApiTags('认证')
@Controller('auth')
export class AdminAuthController {
  constructor(
    private readonly authService: AdminAuthService,
    @Inject(jwtConfig.KEY)
    private readonly cfg: ConfigType<typeof jwtConfig>,
  ) {}

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ windowMs: 60_000, max: 10, keyBy: 'ip' })
  @Post('login')
  @ApiOperation({ summary: '管理员登录' })
  @ApiBaseResponse(AuthTokenVo)
  async login(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<AuthTokenVo> {
    const session = await this.authService.login(dto);
    setRefreshTokenCookie(res, session.refreshToken, this.cookieOptions());
    return { accessToken: session.accessToken, tokenType: 'Bearer' };
  }

  @Public()
  @UseGuards(RefreshJwtAuthGuard)
  @Post('refresh')
  @ApiOperation({ summary: '刷新令牌' })
  @ApiBaseResponse(AuthTokenVo)
  async refresh(
    @CurrentAdminUser() principal: RefreshAuthUser,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<AuthTokenVo> {
    const session = await this.authService.refresh(principal);
    setRefreshTokenCookie(res, session.refreshToken, this.cookieOptions());
    return { accessToken: session.accessToken, tokenType: 'Bearer' };
  }

  @Post('logout')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '登出' })
  @OperationLogDecorator({ action: 'LOGOUT', module: 'Auth' })
  @ApiSuccessResponse()
  async logout(
    @CurrentAdminUser() user: AdminAuthUser,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<void> {
    await this.authService.logout(user);
    clearRefreshTokenCookie(res, this.cookieOptions());
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '当前管理员信息' })
  @ApiBaseResponse(AdminProfileVo)
  me(@CurrentAdminUser() user: AdminAuthUser): AdminProfileVo {
    return {
      uid: user.sub,
      username: user.username,
      roleUids: user.roleUids,
      permissionCodes: user.permissionCodes,
    };
  }

  /** Refresh Token Cookie 选项（来自 jwtConfig，HTTP 传输细节）。 */
  private cookieOptions() {
    return {
      secure: this.cfg.cookieSecure,
      sameSite: this.cfg.cookieSameSite,
      domain: this.cfg.cookieDomain,
    };
  }
}
