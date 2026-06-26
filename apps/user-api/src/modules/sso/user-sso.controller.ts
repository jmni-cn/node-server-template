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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigType } from '@nestjs/config';
import { jwtConfig, ssoConfig } from '@core/config';
import { ApiBaseResponse } from '@core/common';
import {
  CurrentUser,
  Public,
  setRefreshTokenCookie,
  type UserAuthUser,
} from '@platform/auth';

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

  /**
   * 发起「绑定意图」SSO 授权跳转（**需登录**，非 @Public）。
   *
   * 已登录用户访问此端点 → 302 跳转到 provider 授权页（state 携带当前用户，
   * intent=bind）；provider 回调到 `GET /sso/:provider/callback` 后，由
   * {@link UserSsoService} 把经验证的外部身份绑定到当前用户（不登录、不开户）。
   *
   * 这是绑定外部账号的**唯一正确路径**：providerUserId 始终来自服务端验证的回调，
   * 客户端无从伪造。
   */
  @Get(':provider/bind/authorize')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'SSO 绑定授权跳转（需登录）' })
  async bindAuthorize(
    @Param('provider') provider: string,
    @CurrentUser() user: UserAuthUser,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { url } = await this.ssoService.buildBindAuthorizeRedirect(
      provider,
      user.sub,
    );
    void reply.redirect(url, 302);
  }

  @Public()
  @Get(':provider/callback')
  @ApiOperation({ summary: 'SSO 回调（登录下发一次性登录码 / 绑定返回结果）' })
  @ApiBaseResponse(SsoCodeVo)
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Res({ passthrough: true }) res: FastifyReply,
    @Query('state') state?: string,
    @Query('redirectUri') redirectUri?: string,
  ): Promise<SsoCodeVo | { bound: true; provider: string } | void> {
    const result = await this.ssoService.handleCallback(
      provider,
      code,
      state,
      redirectUri,
    );

    // 绑定意图：不签发会话/登录码。配置了前端重定向则 302 携带 bind 成功标记，
    // 否则直接返回绑定结果 JSON。
    if (result.intent === 'bind') {
      if (this.sso.postLoginRedirect) {
        const url = `${this.sso.postLoginRedirect}?bind=success&provider=${encodeURIComponent(provider)}`;
        void res.redirect(url, 302);
        return;
      }
      return { bound: true, provider };
    }

    const loginCode = result.code;
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
