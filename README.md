# NestJS + TypeORM Monorepo Platform Template

A clean, long-lived base for new backend services. Three deployable apps
(`admin-api`, `user-api`, `worker`) share a layered set of libraries
(`core` → `platform` → `domains` → `integrations`). It ships only reusable
platform capabilities — identity, RBAC, system config, audit, queue/worker, SSO —
and contains **no** AI / business-specific code.

> Stack: **NestJS 11 · Fastify · TypeORM (MySQL) · BullMQ + Redis · pino · nestjs-i18n · npm monorepo**

---

## 1. Layout

```
apps/
  admin-api/   back-office HTTP API   (prefix /admin)
  user-api/    end-user HTTP API      (prefix /)
  worker/      queue consumer + cron  (no public HTTP)
libs/
  core/        common, config, database, logger, request-context, i18n
  platform/    auth, security, cache, queue, audit, task, health
  domains/     identity, access-control, system
  integrations/sso
database/      migrations, seeds, factories
references/    architecture & layer specs (the rules new code must follow)
scripts/       automation + architecture guardrails
docker/ deploy/ test/ .cursor/ .github/
```

See [`CONVENTIONS.md`](./CONVENTIONS.md) and [`references/`](./references) for the full rules.

## 2. Prerequisites

- Node.js ≥ 20, npm ≥ 10
- MySQL 8, Redis 7 (or `docker compose -f docker/docker-compose.dev.yml up -d`)

## 3. Quick start

```bash
npm install

# 1. bring up MySQL + Redis
docker compose -f docker/docker-compose.dev.yml up -d mysql redis

# 2. configure env (per app)
cp .env.example env/admin-api.local.env   # then edit
cp .env.example env/user-api.local.env
cp .env.example env/worker.local.env

# 3. create schema + seed base data
npm run migration:run
npm run seed

# 4. run each app
npm run start:dev:admin    # http://localhost:3001/admin  · docs /admin/docs
npm run start:dev:user     # http://localhost:3002        · docs /docs
npm run start:dev:worker   # consumes BullMQ queues + cron
```

Default seeded super admin: `admin` / `Admin@123456` (change immediately).

## 4. Common scripts

| Command | Purpose |
|---|---|
| `npm run start:dev:{admin,user,worker}` | run an app in watch mode |
| `npm run build` | build all three apps to `dist/` |
| `npm run migration:generate -- database/migrations/<Name>` | generate a migration from entity diff |
| `npm run migration:run` / `migration:revert` | apply / roll back migrations |
| `npm run seed` | seed base data |
| `npm run db:reset` | drop + migrate + seed (dev only) |
| `npm run lint` / `npm run format` / `npm run typecheck` | code quality |
| `npm test` / `npm run test:e2e` / `npm run test:cov` | tests |
| `npm run check:all` | run all architecture guardrails (see below) |

## 5. Architecture guardrails

These run in CI and locally (`npm run check:all`) and encode the non-negotiable rules:

- `check:no-ai` — fails if any AI / `ai-fastapi` / prompt / model / embedding traces appear.
- `check:boundaries` — apps must not import repositories directly, and apps must not import each other.
- `check:layers` — `core → platform → domains → integrations → apps` dependency direction;
  entity/dto/vo/mapper/assembler/service naming & placement.

The same rules are mirrored in [`.cursor/rules`](./.cursor/rules) so AI assistants follow them.

## 6. Key invariants (do not break)

1. `admin-api`, `user-api`, `worker` never import each other.
2. App layer calls **libs services only** — never a TypeORM repository.
3. If a domain service/method is missing, add it to the domain lib and export it — never query a repo from an app.
4. Controllers never return entities and contain no business logic.
5. Mappers are pure; assemblers aggregate VOs; services hold business logic and own repositories.
6. Long-running work is enqueued and executed in `worker`.
7. Every write endpoint uses `@OperationLog(...)`; sensitive endpoints use `@RateLimit(...)`.
8. Business errors use `BusinessException`; responses use the unified envelope; pagination uses `PaginationDto`/`PageResultVo`.
9. All schema changes go through migrations. `synchronize` is always `false`.
10. No AI / ai-fastapi / prompt / model-provider / embedding anything.

## 7. Creating a new project from this template

```bash
# 1. copy the template
cp -r node-server-template my-new-service && cd my-new-service

# 2. rename the package, db name, JWT secrets in package.json + env files
# 3. remove apps you don't need (e.g. drop user-api) from nest-cli.json + package.json scripts
# 4. scaffold your first feature module / domain
npx ts-node scripts/create-domain.ts billing
npx ts-node scripts/create-module.ts admin-api invoices

# 5. add entities, generate a migration, seed, run
npm run migration:generate -- database/migrations/AddInvoices
npm run migration:run && npm run start:dev:admin
```

Read [`references/LAYER-SPEC.md`](./references/LAYER-SPEC.md) and
[`references/MODULE-SPEC.md`](./references/MODULE-SPEC.md) before adding code.

## 8. App responsibilities (summary)

- **admin-api** — back-office only: admin login/SSO, user management, roles/permissions/menus,
  dictionaries, system config, operation-log queries, task management & manual triggers, health.
- **user-api** — end-user only: register, login, refresh, logout, me, SSO, profile, password,
  sessions, external-account binding, health.
- **worker** — consumes queues (audit, user events, sso sync, task cleanup/retry, system
  maintenance) and runs cron schedules. No public HTTP API.
