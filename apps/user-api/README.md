# user-api

用户端 API（NestJS 11 + Fastify）。默认无全局前缀（`USER_API_PREFIX` 默认 ''）。

## 启动

```bash
npm run start:dev:user
npm run build:user && npm run start:user
```

环境变量见根目录 `.env.example` + `.env.user-api.example`。

## 全局守卫

`app.module.ts` 注册一个全局 `APP_GUARD`：`UserJwtAuthGuard`（默认所有路由要求
user JWT，`@Public()` 豁免）。用户端无 RBAC，因此不注册 `PermissionsGuard`。

全局 `APP_INTERCEPTOR`：`OperationLogInterceptor`（写端点审计入队）。

## 路由

| 方法 | 路径 | 守卫 / 装饰 |
|------|------|-------------|
| GET | `/` | `@Public` 服务信息 |
| POST | `/auth/register` | `@Public` + `@RateLimit` + 审计 |
| POST | `/auth/login` | `@Public` + `@RateLimit` |
| POST | `/auth/refresh` | `@Public` + `RefreshJwtAuthGuard` |
| POST | `/auth/logout` | JWT + 审计 |
| GET | `/auth/me` | JWT |
| GET | `/sso/:provider/authorize` | `@Public` |
| GET | `/sso/:provider/callback` | `@Public` |
| GET | `/users/me` | JWT |
| GET/PUT | `/users/me/profile` | JWT（写带审计） |
| PUT | `/users/me/password` | JWT + `@RateLimit` + 审计 |
| GET | `/users/me/security/sessions` | JWT |
| DELETE | `/users/me/security/sessions/:uid` | JWT + 审计 |
| GET/POST | `/users/me/security/external-accounts` | JWT（写带审计） |
| DELETE | `/users/me/security/external-accounts/:uid` | JWT + 审计 |
| GET | `/health` | `@Public` |

## 约束

控制器不含业务逻辑、不注入 Repository、只返回 VO；写端点带 `@OperationLogDecorator`；
敏感端点带 `@RateLimit`；错误统一用 `BusinessException`。
