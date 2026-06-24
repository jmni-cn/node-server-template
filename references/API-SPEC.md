# API-SPEC

Conventions every HTTP endpoint follows. Implemented by `@core/common`
(`TransformInterceptor`, `AllExceptionsFilter`, response VOs, Swagger
decorators).

## Unified response envelope

Controllers return raw data / VOs. `TransformInterceptor` wraps successful
responses:

```json
{
  "success": true,
  "code": "OK",
  "message": "...",
  "data": { },
  "timestamp": 1700000000000,
  "path": "/admin/users",
  "requestId": "...",
  "traceId": "..."
}
```

Errors are produced by throwing `BusinessException(code)`. `AllExceptionsFilter`
renders the error envelope and i18n-translates `error.<CODE>`:

```json
{
  "success": false,
  "code": "USER_NOT_FOUND",
  "message": "<translated error.USER_NOT_FOUND>",
  "data": null,
  "timestamp": 1700000000000,
  "path": "/admin/users/usr_x",
  "requestId": "...",
  "traceId": "..."
}
```

Never hand-build the envelope and never `res.send` from a controller.

## Error codes

`SCREAMING_SNAKE` string codes grouped by prefix (`AUTH_`, `USER_`, `RBAC_`,
`SYS_`, `RES_`, `REQ_`, `OP_`, `SSO_`, `RATE_`, `TASK_`). HTTP status comes from
the `ErrorCodeHttpStatus` registry, extended via `registerErrorCodeHttpStatus`.
See ERROR-CODE-SPEC.md.

## Pagination

- Input: extend/accept `PaginationDto` (`page`, `pageSize`).
- Output: `PageResultVo<T>` built with `createPageResult(items, total, dto)`.
- The interceptor wraps the `PageResultVo` inside `data` like any other payload.

## Swagger decorators (from `@core/common`)

| Decorator | Use for |
|-----------|---------|
| `@ApiBaseResponse(Vo)` | single-object response |
| `@ApiArrayResponse(Vo)` | array response |
| `@ApiPaginatedResponse(Vo)` | `PageResultVo<Vo>` response |
| `@ApiSuccessResponse()` | `void` / boolean success response |

Always annotate VO properties with `@ApiProperty`. Swagger is exposed per app at
`/<prefix>/<SWAGGER_PATH>` (admin: `/admin/docs`, user: `/docs`), toggled by
`*_SWAGGER_ENABLED`.

## Route prefixes

- **admin-api**: global prefix `admin` → `/admin/auth/login`, `/admin/users`,
  `/admin/roles`, `/admin/permissions`, `/admin/menus`, `/admin/system-configs`,
  `/admin/dictionaries`, `/admin/operation-logs`, `/admin/tasks`, `/admin/health`.
- **user-api**: no prefix → `/auth/*`, `/sso/:provider/*`, `/users/me/*`, `/health`.
- **worker**: no HTTP API (optional health on `WORKER_HEALTH_PORT`).
