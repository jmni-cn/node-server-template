# TEST-SPEC

Three test kinds, three locations. Shared scaffolding lives in `/test`.

## Layout

| Kind | Location | Pattern | Runner |
|------|----------|---------|--------|
| **unit** | colocated next to source in `libs/**` and `apps/**` | `*.spec.ts` | `npm run test:unit` |
| **integration** | `apps/<app>/test/integration` | `*.integration.spec.ts` | `npm test` |
| **e2e** | `apps/<app>/test/e2e` | `*.e2e-spec.ts` | `npm run test:e2e` (config `test/jest-e2e.json`) |

- Unit tests mock collaborators (no DB/Redis) — fast, pure logic (services,
  mappers, guards).
- Integration tests exercise a real wiring of a few units (e.g. a worker
  processor calling a service replaced by a mock) — see
  `apps/worker/test/integration/audit-log.processor.integration.spec.ts`.
- e2e tests boot the Fastify Nest app and hit real routes; they need MySQL +
  Redis (CI service containers or `docker/docker-compose.test.yml`).

## Shared scaffold (`/test`)

- `test/jest-e2e.json` — e2e jest config; reuses the `@core/@platform/@domains/
  @integrations` `moduleNameMapper`, `testRegex` `e2e-spec`, `setupFiles`
  `test/setup/jest.setup.ts`.
- `test/setup/jest.setup.ts` — `reflect-metadata` + safe env defaults.
- `test/setup/test-db.setup.ts` — build/init a test DataSource and **run
  migrations** (never `synchronize`; MIGRATION-SPEC.md).
- `test/helpers/` — `auth-test.helper.ts` (mint JWTs), `database-test.helper.ts`
  (truncate/seed/rollback), `request-test.helper.ts` (boot Fastify app + supertest).
- `test/fixtures/` — `users.fixture.ts`, `roles.fixture.ts`, `permissions.fixture.ts`.

## What to cover

At minimum, the template's platform behaviors:

- **login** — valid credentials issue access + refresh; wrong password →
  `AUTH_PASSWORD_INCORRECT`; disabled user → `AUTH_USER_DISABLED`.
- **register** — creates user; duplicate → resource conflict.
- **refresh** — valid refresh token returns a new pair; expired/blacklisted →
  `AUTH_TOKEN_EXPIRED`/`AUTH_TOKEN_INVALID`.
- **permission** — admin route without the required `@Permissions(...)` →
  403; with it → 200 (PermissionsGuard via ACCESS_CHECKER).
- **rate-limit** — exceeding `@RateLimit` returns the rate-limited status with
  `X-RateLimit-*` headers (RATE_ code).
- **sso-callback** — bad `state` → `SSO_STATE_INVALID`; happy path links identity
  and mints tokens.
- **audit** — a write endpoint enqueues `WRITE_OPERATION_LOG`; the worker
  processor persists it.
- **queue** — producer enqueues with the right `QUEUE_NAMES`/`JOB_NAMES`; an
  unknown job name throws in the processor.
- **migration** — `migration:run` brings an empty DB to current schema (the e2e
  DB bootstrap covers this).
- **seed** — seeding produces an admin with `rbac:*` and base dictionaries.

## Rules

- e2e uses the unified envelope: assert `body.success` and `body.code`, not raw
  shapes (API-SPEC.md).
- Reset state between e2e tests with `truncateAll()` + reseed, or `withRollback`.
- Never enable `synchronize` in tests; run migrations.
