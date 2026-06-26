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
  CurrentUser,
  Public,
  RefreshJwtAuthGuard,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  type RefreshAuthUser,
  type UserAuthUser,
} from '@platform/auth';
import { RateLimit, RateLimitGuard } from '@platform/security';
import { OperationLogDecorator } from '@platform/audit';
import { LoginDto, RegisterDto } from '@domains/identity';

import { UserAuthService } from './user-auth.service';
import { AuthTokenVo, UserIdentityVo } from './vo';

/**
 * 用户端认证控制器：注册、登录、令牌刷新、登出、当前用户。
 *
 * 控制器保持轻薄：跨服务编排（令牌签发、会话轮换、安全事件）由
 * {@link UserAuthService} 负责；控制器仅做请求解析、调用单一应用服务方法、
 * HTTP 传输（HttpOnly Cookie 下发 Refresh Token）与 VO 映射。
 */
@ApiTags('认证')
@Controller('auth')
export class UserAuthController {
  constructor(
    private readonly authService: UserAuthService,
    @Inject(jwtConfig.KEY)
    private readonly cfg: ConfigType<typeof jwtConfig>,
  ) {}

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ windowMs: 60_000, max: 5, keyBy: 'ip' })
  @Post('register')
  @ApiOperation({ summary: '用户注册' })
  @OperationLogDecorator({ action: 'REGISTER', module: 'Auth' })
  @ApiBaseResponse(AuthTokenVo)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<AuthTokenVo> {
    const session = await this.authService.register(dto);
    setRefreshTokenCookie(res, session.refreshToken, this.cookieOptions());
    return { accessToken: session.accessToken, tokenType: 'Bearer' };
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ windowMs: 60_000, max: 10, keyBy: 'ip' })
  @Post('login')
  @ApiOperation({ summary: '用户登录' })
  @OperationLogDecorator({ action: 'LOGIN', module: 'Auth' })
  @ApiBaseResponse(AuthTokenVo)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<AuthTokenVo> {
    const session = await this.authService.login(dto);
    setRefreshTokenCookie(res, session.refreshToken, this.cookieOptions());
    return { accessToken: session.accessToken, tokenType: 'Bearer' };
  }

  @Public()
  @UseGuards(RateLimitGuard, RefreshJwtAuthGuard)
  @RateLimit({ windowMs: 60_000, max: 30, keyBy: 'ip' })
  @Post('refresh')
  @ApiOperation({ summary: '刷新令牌（轮换 + 盗用检测）' })
  @ApiBaseResponse(AuthTokenVo)
  async refresh(
    @CurrentUser() principal: RefreshAuthUser,
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
    @CurrentUser() user: UserAuthUser,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<void> {
    await this.authService.logout(user);
    clearRefreshTokenCookie(res, this.cookieOptions());
  }

  @Post('logout-all')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '登出全部设备' })
  @OperationLogDecorator({ action: 'LOGOUT_ALL', module: 'Auth' })
  @ApiSuccessResponse()
  async logoutAll(
    @CurrentUser() user: UserAuthUser,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<void> {
    await this.authService.logoutAll(user);
    clearRefreshTokenCookie(res, this.cookieOptions());
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '当前用户身份' })
  @ApiBaseResponse(UserIdentityVo)
  me(@CurrentUser() user: UserAuthUser): UserIdentityVo {
    return { uid: user.sub, username: user.username };
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
