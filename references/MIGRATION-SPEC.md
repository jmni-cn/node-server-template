# MIGRATION-SPEC

The database is **MySQL** (`mysql2`) and `synchronize` is **always `false`**.
Every schema change ships as a TypeORM migration under `/database/migrations`.
The CLI data source is `database/data-source.ts`.

## Why `synchronize: false`

Auto-sync would silently alter production schema and reorder/destroy columns. All
schema state is explicit, reviewable, and reversible through migrations. There is
no exception, including in tests (the test setup runs migrations, never sync —
see TEST-SPEC.md).

## Commands (npm scripts)

| Script | Purpose |
|--------|---------|
| `npm run migration:generate -- database/migrations/<Name>` | diff entities vs. DB, emit a migration |
| `npm run migration:create -- database/migrations/<Name>` | empty migration (hand-written DDL/data) |
| `npm run migration:run` | apply pending migrations |
| `npm run migration:revert` | revert the last applied migration |
| `npm run migration:show` | list applied/pending |

`migration:generate` requires a reachable DB and built/compilable entities. The
data source globs entities from `libs/**/*.entity.ts` and `apps/**/*.entity.ts`,
and migrations from `database/migrations/*.ts`. The bookkeeping table is
`migrations`.

## Naming

- File: `<timestamp>-<PascalChange>.ts` (the generator prepends the timestamp),
  e.g. `1700000000000-InitSchema.ts`, `1701234567890-AddUserStatusIndex.ts`.
- Class: matches the change in PascalCase + timestamp suffix (TypeORM convention),
  e.g. `AddUserStatusIndex1701234567890`.
- One logical change per migration. Keep `up` and `down` symmetric so
  `migration:revert` truly reverts.

## Rules

- Never edit an already-applied migration; add a new one.
- Never call `synchronize` or `dropSchema` against a shared DB.
- Charset is `utf8mb4` (see `docker/mysql/init.sql`); declare text columns
  accordingly.
- Seed data is **not** a migration — use `npm run seed` (`database/seeds`).
