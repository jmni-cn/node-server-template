# @core/database

TypeORM (MySQL) infrastructure. `synchronize: false` always; schema changes via migrations.

## Exports
- `DatabaseModule` — `TypeOrmModule.forRootAsync` using `databaseConfig` from `@core/config`, `autoLoadEntities: true`.
- `createTypeOrmOptions(config, { entities, migrations })` + `databaseConfigFromEnv()` — shared factory for module and CLI.
- `data-source.ts` — default-exported `DataSource` for the TypeORM CLI (entities glob `libs/**/*.entity.ts`, migrations `database/migrations/*.ts`).
- Entity base classes: `BaseEntity`, `AuditableEntity` (alias of `BaseEntity`), `ImmutableBaseEntity`, `SystemBaseEntity`. Each subclass sets `protected static uidPrefix`.
- `TransactionHelper.run(manager => ...)` — `DataSource.transaction` wrapper.
