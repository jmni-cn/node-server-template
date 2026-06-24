import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigType } from '@nestjs/config';
import { jwtConfig, ssoConfig } from '@core/config';
import { ApiBaseResponse } from '@core/common';
import { Public, setRefreshTokenCookie } from '@platform/auth';

import { AuthTokenVo } from '../auth/vo';
import { AdminSsoService } from './admin-sso.service';
import { ExchangeCodeDto } from './dto';
import { SsoCodeVo } from './vo';

/**
 * 管理后台 SSO 控制器：授权跳转、回调下发一次性登录码、code 换取令牌。
 *
 * 控制器保持轻薄：授权地址构建、state 校验、回调换取/会话签发、一次性码签发与消费
 * 等编排由 {@link AdminSsoService} 负责；控制器仅做请求解析、HTTP 重定向、
 * Refresh Token HttpOnly Cookie 下发（与用户端一致）与 VO 映射。
 * 令牌永不出现在回调重定向 URL 中。
 */
@ApiTags('SSO')
@Controller('sso')
export class AdminSsoController {
  constructor(
    private readonly ssoService: AdminSsoService,
    @Inject(ssoConfig.KEY)
    private readonly sso: ConfigType<typeof ssoConfig>,
    @Inject(jwtConfig.KEY)
    private readonly jwt: ConfigType<typeof jwtConfig>,
  ) {}

  @Public()
  @Get(':provider/authorize')
  @ApiOperation({ summary: 'SSO 授权跳转' })
  async authorize(
    @Param('provider') provider: string,
    @Res() reply: FastifyReply,
    @Query('redirectUri') redirectUri?: string,
  ): Promise<void> {
    const { url } = await this.ssoService.buildAuthorizeRedirect(
      provider,
      redirectUri,
    );
    void reply.redirect(url, 302);
  }

  @Public()
  @Get(':provider/callback')
  @ApiOperation({ summary: 'SSO 回调（下发一次性登录码）' })
  @ApiBaseResponse(SsoCodeVo)
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Res({ passthrough: true }) res: FastifyReply,
    @Query('state') state?: string,
    @Query('redirectUri') redirectUri?: string,
  ): Promise<SsoCodeVo | void> {
    const { code: loginCode } = await this.ssoService.handleCallback(
      provider,
      code,
      state,
      redirectUri,
    );
    if (this.sso.postLoginRedirect) {
      const url = `${this.sso.postLoginRedirect}?code=${encodeURIComponent(loginCode)}`;
      void res.redirect(url, 302);
      return;
    }
    return { code: loginCode };
  }

  @Public()
  @Post('exchange')
  @ApiOperation({ summary: '一次性登录码换取令牌' })
  @ApiBaseResponse(AuthTokenVo)
  async exchange(
    @Body() dto: ExchangeCodeDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<AuthTokenVo> {
    const session = await this.ssoService.exchange(dto.code);
    // 与用户端一致：Refresh Token 通过 HttpOnly Cookie 下发，响应体仅返回 access token。
    setRefreshTokenCookie(res, session.refreshToken, {
      secure: this.jwt.cookieSecure,
      sameSite: this.jwt.cookieSameSite,
      domain: this.jwt.cookieDomain,
    });
    return { accessToken: session.accessToken, tokenType: 'Bearer' };
  }
}
