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
import { UserSsoService } from './user-sso.service';
import { ExchangeCodeDto } from './dto';
import { SsoCodeVo } from './vo';

/**
 * 用户端 SSO 控制器：授权跳转、回调下发一次性登录码、code 换取令牌。
 *
 * 控制器保持轻薄：授权地址构建、state 校验、回调换取/会话签发、一次性码签发与消费
 * 等编排由 {@link UserSsoService} 负责；控制器仅做请求解析、HTTP 重定向、HttpOnly
 * Cookie 下发 Refresh Token 与 VO 映射。令牌永不出现在回调重定向 URL 中。
 */
@ApiTags('SSO')
@Controller('sso')
export class UserSsoController {
  constructor(
    private readonly ssoService: UserSsoService,
    @Inject(jwtConfig.KEY)
    private readonly cfg: ConfigType<typeof jwtConfig>,
    @Inject(ssoConfig.KEY)
    private readonly sso: ConfigType<typeof ssoConfig>,
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
    // 配置了前端重定向地址：302 携带 code（无令牌）。
    if (this.sso.postLoginRedirect) {
      const url = `${this.sso.postLoginRedirect}?code=${encodeURIComponent(loginCode)}`;
      void res.redirect(url, 302);
      return;
    }
    // 否则直接返回 { code }。
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
    setRefreshTokenCookie(res, session.refreshToken, this.cookieOptions());
    return { accessToken: session.accessToken, tokenType: 'Bearer' };
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
