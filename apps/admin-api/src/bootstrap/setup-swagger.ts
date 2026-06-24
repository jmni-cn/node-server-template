import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * 配置 Swagger 文档。
 *
 * 由 `ADMIN_SWAGGER_ENABLED` 开关控制，路径由 `ADMIN_SWAGGER_PATH` 决定，
 * 挂载在全局前缀之下（默认 `admin/docs`）。
 */
export function setupSwagger(app: NestFastifyApplication): void {
  const config = app.get(ConfigService);
  const enabled =
    (config.get<string>('ADMIN_SWAGGER_ENABLED') ?? 'false') === 'true';
  if (!enabled) {
    return;
  }

  const prefix = config.get<string>('ADMIN_API_PREFIX') ?? 'admin';
  const docsPath = config.get<string>('ADMIN_SWAGGER_PATH') ?? 'docs';
  const fullPath = `${prefix}/${docsPath}`;

  const documentConfig = new DocumentBuilder()
    .setTitle('Admin API')
    .setDescription('管理后台 API 文档')
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
    .addTag('认证', '登录、登出、令牌刷新')
    .addTag('SSO', '第三方单点登录')
    .addTag('用户管理', '用户的增删改查')
    .addTag('角色管理', '角色的增删改查与授权')
    .addTag('权限管理', '权限的增删改查')
    .addTag('菜单管理', '菜单的增删改查')
    .addTag('字典管理', '数据字典')
    .addTag('系统配置', '系统配置项')
    .addTag('操作日志', '审计日志查询')
    .addTag('任务管理', '异步任务查询/重试/触发')
    .addTag('健康检查', '存活与依赖探针')
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig);
  SwaggerModule.setup(fullPath, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
