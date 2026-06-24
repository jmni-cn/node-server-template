# admin-api

管理后台 API（NestJS 11 + Fastify）。全局路由前缀 `admin`（可由 `ADMIN_API_PREFIX` 覆盖）。

## 启动

```bash
npm run start:dev:admin     # 开发（watch）
npm run build:admin && npm run start:admin   # 生产
```

环境变量见根目录 `.env.example` + `.env.admin-api.example`。

## 全局守卫

`app.module.ts` 注册两个全局 `APP_GUARD`（按顺序）：

1. `AdminJwtAuthGuard` —— 默认所有路由要求 admin JWT，`@Public()` 豁免。
2. `PermissionsGuard` —— 读取 `@Permissions(...)` 元数据做 RBAC 校验；
   `ACCESS_CHECKER` 端口由导入的 `AccessControlModule` 提供。

另注册一个全局 `APP_INTERCEPTOR`：`OperationLogInterceptor`，读取
`@OperationLogDecorator` 元数据并将审计日志入队（AUDIT 队列，worker 落库）。

## 路由

| 方法 | 路径 | 守卫 / 装饰 |
|------|------|-------------|
| GET | `/admin` | `@Public` 服务信息 |
| POST | `/admin/auth/login` | `@Public` + `@RateLimit` |
| POST | `/admin/auth/refresh` | `@Public` + `RefreshJwtAuthGuard` |
| POST | `/admin/auth/logout` | JWT + 审计 |
| GET | `/admin/auth/me` | JWT |
| GET | `/admin/sso/:provider/authorize` | `@Public` |
| GET | `/admin/sso/:provider/callback` | `@Public` |
| GET/POST/PATCH | `/admin/users` | `@Permissions('rbac:user:*')` + 写审计 |
| GET/POST/PATCH/DELETE | `/admin/roles` | `@Permissions('rbac:role:*')` + 写审计 |
| GET/POST/PATCH | `/admin/permissions` | `@Permissions('rbac:permission:*')` + 写审计 |
| GET/POST/PATCH/DELETE | `/admin/menus` | `@Permissions('rbac:menu:*')` + 写审计 |
| GET/POST/PATCH | `/admin/dictionaries` | `@Permissions('sys:dict:*')` + 写审计 |
| GET/POST/DELETE | `/admin/system-configs` | `@Permissions('sys:config:*')` + 写审计 |
| GET | `/admin/operation-logs` | `@Permissions('sys:audit:read')` |
| GET/POST | `/admin/tasks` | `@Permissions('sys:task:*')` + 写审计 |
| GET | `/admin/health` | `@Public` |

## 约束

控制器不含业务逻辑、不注入 Repository、只返回 VO；写端点带 `@OperationLogDecorator`；
敏感端点带 `@RateLimit`；错误统一用 `BusinessException`。
