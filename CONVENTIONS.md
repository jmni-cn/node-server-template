# node-server-template — Build Conventions (authoritative)

> This file is the single source of truth for everyone (humans + agents) building this
> template. Read it before writing any file. It exists to keep the monorepo internally
> consistent. It is also shipped in the repo as living documentation.

## 0. What this template is

A clean, long-lived **NestJS 11 + TypeORM (MySQL) monorepo base** for new projects.
It is distilled from an internal platform server but is **not** a copy of it. It contains
only reusable platform capabilities: identity, access-control, system config, audit,
queue/worker, SSO. It contains **NO** AI / ai-fastapi / prompt / model-provider /
embedding / RAG / customer-support / article / tenant business code.

**Identity is split into two subject tables** (`SubjectType = 'admin' | 'user'`):
`admin_users` (`AdminUser`, managed by admin-api under `/admin/administrators`) and
`end_users` (`EndUser` + end-only `UserProfile`, self-service in user-api and managed
by admin-api under `/admin/users`). The satellite tables `UserCredential`,
`UserSession`, `SecurityEvent`, `ExternalIdentity` are **shared** across both subjects
and carry a `subjectType` column; every domain method that touches them is
subjectType-aware. admin-api always threads `subjectType: 'admin'`; user-api always
threads `subjectType: 'user'`. RBAC (`@domains/access-control`) has **no** subjectType —
`UserRole.userId` is always an `AdminUser.uid`.

## 1. Hard decisions (do not deviate)

- **Package manager: npm** (single root `package.json`, NestJS monorepo style — NOT pnpm,
  NO `pnpm-workspace.yaml`, NO npm `workspaces` field). Libs are wired via tsconfig path
  aliases + `nest-cli.json` projects, exactly like a standard Nest monorepo.
- **Database: MySQL** via `mysql2`. `type: 'mysql'`, `synchronize: false` always.
- **HTTP platform: Fastify** (`@nestjs/platform-fastify`).
- **Node 20+, TypeScript 5.7+, NestJS 11.**
- **Logging: pino.** **i18n: nestjs-i18n.** **Queue: BullMQ + ioredis.**

## 2. Directory groups & import aliases

Libs are grouped into four layers. Each lib lives at `libs/<group>/<name>/src` with an
`index.ts` barrel. Import aliases (configured in `tsconfig.base.json`, `nest-cli.json`,
and jest `moduleNameMapper`):

| Layer | Alias root | Path |
|-------|-----------|------|
| core | `@core/<name>` | `libs/core/<name>/src` |
| platform | `@platform/<name>` | `libs/platform/<name>/src` |
| domains | `@domains/<name>` | `libs/domains/<name>/src` |
| integrations | `@integrations/<name>` | `libs/integrations/<name>/src` |

Concrete aliases that MUST exist:

```
@core/common          libs/core/common/src
@core/config          libs/core/config/src
@core/database        libs/core/database/src
@core/logger          libs/core/logger/src
@core/request-context libs/core/request-context/src
@core/i18n            libs/core/i18n/src
@platform/auth        libs/platform/auth/src
@platform/security    libs/platform/security/src
@platform/cache       libs/platform/cache/src
@platform/queue       libs/platform/queue/src
@platform/audit       libs/platform/audit/src
@platform/task        libs/platform/task/src
@platform/health      libs/platform/health/src
@domains/identity     libs/domains/identity/src
@domains/access-control libs/domains/access-control/src
@domains/system       libs/domains/system/src
@integrations/sso     libs/integrations/sso/src
```

Each alias resolves both the barrel (`@core/common`) and subpaths (`@core/common/*`).

### Layer dependency rules (enforced by check-layer-rules / eslint)

```
apps        ->  may import @core, @platform, @domains, @integrations
integrations->  may import @core, @platform, @domains
domains     ->  may import @core, @platform   (NOT other domains, NOT integrations, NOT apps)
platform    ->  may import @core              (NOT domains, NOT integrations, NOT apps)
core        ->  may import @core only         (leaf)
```

- `apps/*` MUST NOT import each other (admin-api, user-api, worker are isolated).
- `apps/*` MUST NOT import a TypeORM `Repository` or `@nestjs/typeorm` `getRepository`
  directly. Apps call **domain/platform services** only.
- If a needed domain service / method does not exist, ADD it to the domain lib and export
  it from the lib's `index.ts`, then call it from the app. Never reach into a repository
  from an app to "get it working".

## 3. Layering inside a domain/platform lib

```
src/
  entities/      TypeORM entities (extend BaseEntity / SystemBaseEntity)
  dto/           input DTOs (class-validator) — service-level inputs
  vo/            view objects returned to controllers (Swagger @ApiProperty)
  mapper/        pure entity<->vo/dto object mapping, NO side effects, NO injected deps
  assembler/     aggregates multiple mappers / sources into composite VOs (may inject services)
  services/      business logic; owns repositories; the ONLY place repos are injected
  types/         shared TS types/interfaces
  constants/     error codes, tokens, enums
  index.ts       public barrel — export module + services + entities + dto + vo + types
```

Rules:
- `controller` (apps only) NEVER returns an entity; returns a VO or `void`.
- `controller` contains NO business logic, NO repository access.
- `mapper` functions are pure (no DI, no async I/O).
- `assembler` composes VOs (may call services).
- `service` never touches HTTP (no `@Req`, no `FastifyReply`).
- Long-running work is enqueued to BullMQ and executed in `worker` processors only.

### Application services (apps) — keep controllers thin

Controllers are a thin HTTP layer. They MUST NOT orchestrate multiple lib services
or contain business branching (status checks, token issuance, session rotation,
security-event recording, etc.). Any handler that would touch **more than one lib
service** or apply a business rule must delegate to an **app-level application
service** at `apps/<app>/src/modules/<feature>/<feature>.service.ts`.

- The application service is a plain `@Injectable()` registered in the feature
  module `providers`. It composes lib services (`@core`/`@platform`/`@domains`/
  `@integrations`) and may read `RequestContextService` for ip/userAgent.
- It MUST NOT inject a TypeORM `Repository` (same rule as controllers) and MUST NOT
  import another app.
- **HTTP transport stays in the controller.** Cookies / `@Res` / `FastifyReply` /
  redirects live in the controller; the application service returns **plain data**
  (e.g. `AuthSession = { accessToken; refreshToken; refreshExpiresAt }`) and the
  controller does the cookie I/O and maps to a VO.
- A pure single-call delegation (controller → one domain service method → return VO)
  needs no application service — call the domain service directly.

## 4. Naming

- Files: kebab-case with role suffix — `user.entity.ts`, `create-user.dto.ts`,
  `user.vo.ts`, `user.mapper.ts`, `user.assembler.ts`, `user.service.ts`,
  `admin-users.controller.ts`, `user-registered.processor.ts`, `cleanup.schedule.ts`.
- Classes: PascalCase matching file role — `UserEntity`? NO. Entities are bare PascalCase
  (`User`, `Role`). Other roles keep suffix: `CreateUserDto`, `UserVo`, `UserService`,
  `UserMapper`, `AdminUsersController`.
- Error codes: SCREAMING_SNAKE string enums grouped by prefix (`AUTH_`, `USER_`, `RBAC_`,
  `SYS_`, `RES_`, `REQ_`, `OP_`, `SSO_`, `RATE_`, `TASK_`).
- Each lib that throws domain errors defines its own `*-error-codes.ts` enum and registers
  HTTP status mapping (see core/common error-codes).

## 5. Unified HTTP response

All controllers return raw data / VOs; `TransformInterceptor` wraps into:

```json
{ "success": true, "code": "OK", "message": "...", "data": {}, "timestamp": 0,
  "path": "/...", "requestId": "...", "traceId": "..." }
```

- Errors -> `BusinessException(SomeErrorCode)`. `AllExceptionsFilter` renders the error
  envelope and i18n-translates `error.<CODE>`.
- Swagger: annotate with `@ApiBaseResponse(Vo)`, `@ApiArrayResponse(Vo)`,
  `@ApiPaginatedResponse(Vo)`, `@ApiSuccessResponse()` from `@core/common`.
- Pagination: input `PaginationDto`, output `PageResultVo<T>` via `createPageResult(...)`.

## 6. Entities

- Extend `BaseEntity` (has id bigint, uid varchar(32) with `@BeforeInsert` prefixed uid,
  created/updated/deleted timestamps + createdBy/updatedBy(+username)).
- System-generated rows extend `SystemBaseEntity` (no user-attribution columns).
- Every entity sets `protected static uidPrefix = 'xxx'`.
- All schema changes via TypeORM migration in `/database/migrations`. `synchronize:false`.
- **Identity entities** (see §0): two subject tables `admin_users` (`AdminUser`) and
  `end_users` (`EndUser`, + end-only `UserProfile`); shared satellites `UserCredential`,
  `UserSession`, `SecurityEvent`, `ExternalIdentity` carry a `subjectType` column and are
  keyed by `(subjectType, userId)`. Domain services for the satellites are
  subjectType-aware; never assume a single users table.

## 7. Cross-cutting decorators (apps)

- `@Public()` to open a route; otherwise JWT guard applies.
- `@RateLimit({...})` + `RateLimitGuard` on sensitive endpoints (login/register/sso/password).
- `@OperationLog({...})` on every write endpoint -> audit log via interceptor + worker.
- `@CurrentUser()` / `@CurrentAdminUser()` to read the authenticated principal.
- `@Permissions('rbac:user:read')` + `PermissionsGuard` on admin endpoints.

Controllers carry the decorators/guards and do HTTP transport only; cross-service
orchestration lives in an app application service (see §3 "Application services").

## 8. Route prefixes

- admin-api: global prefix `admin` -> `/admin/auth/login`, `/admin/users` (end users),
  `/admin/administrators` (admin accounts), `/admin/roles`, `/admin/permissions`,
  `/admin/menus`, `/admin/system-configs`, `/admin/dictionaries`, `/admin/operation-logs`,
  `/admin/tasks`, `/admin/health`.
- user-api: no `admin` prefix -> `/auth/*`, `/sso/:provider/*`, `/users/me/*`, `/health`.
- worker: no HTTP server (or health-only). Consumes queues + cron schedules.

## 9. Env files

`.env.example` (shared) + `.env.admin-api.example` + `.env.user-api.example` +
`.env.worker.example`. Dev loads `env/<APP_NAME>.local.env`. Production reads real env.
Shared keys: NODE_ENV, APP_NAME, DB_*, REDIS_*, JWT_SECRET, JWT_REFRESH_SECRET, LOG_LEVEL.

## 10. Absolutely forbidden in this template

Any of these strings/concepts in code, deps, docs, env, docker: `ai-fastapi`, `openai`,
`embedding`, `prompt`, `model-provider`, `rag`, `llm`, `cs-domain`, customer-support
ticket logic, article-domain, tenant-domain, rule-engine, pas. `check-no-ai.ts` scans for
these and CI fails on hits.
