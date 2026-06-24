import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * 配置 Swagger 文档（由 `USER_SWAGGER_ENABLED` 开关控制）。
 * 路径由 `USER_SWAGGER_PATH` 决定，挂载在全局前缀（若有）之下。
 */
export function setupSwagger(app: NestFastifyApplication): void {
  const config = app.get(ConfigService);
  const enabled =
    (config.get<string>('USER_SWAGGER_ENABLED') ?? 'false') === 'true';
  if (!enabled) {
    return;
  }

  const prefix = config.get<string>('USER_API_PREFIX') ?? '';
  const docsPath = config.get<string>('USER_SWAGGER_PATH') ?? 'docs';
  const fullPath = prefix ? `${prefix}/${docsPath}` : docsPath;

  const documentConfig = new DocumentBuilder()
    .setTitle('User API')
    .setDescription('用户端 API 文档')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: '请输入 JWT 访问令牌',
      },
      'bearer',
    )
    .addTag('认证', '注册、登录、登出、令牌刷新')
    .addTag('SSO', '第三方单点登录')
    .addTag('个人资料', '当前用户资料')
    .addTag('安全中心', '密码、会话、外部账号')
    .addTag('健康检查', '存活与依赖探针')
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig);
  SwaggerModule.setup(fullPath, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
