# NAMING-SPEC

Files are kebab-case with a role suffix. Classes are PascalCase matching the role
(entities are the exception: bare PascalCase, no `Entity` suffix).

## File + class naming table

| Role | File | Class | Notes |
|------|------|-------|-------|
| Entity | `user.entity.ts` | `User` | bare name; extends `BaseEntity`/`SystemBaseEntity`; sets `uidPrefix` |
| DTO | `create-user.dto.ts` | `CreateUserDto` | class-validator; service-level input |
| VO | `user.vo.ts` | `UserVo` | returned to controllers; `@ApiProperty` |
| Mapper | `user.mapper.ts` | `UserMapper` | pure; no DI, no async I/O |
| Assembler | `user.assembler.ts` | `UserAssembler` | composes VOs; may inject services |
| Service | `user.service.ts` | `UserService` | owns repositories; business logic |
| Controller | `admin-users.controller.ts` | `AdminUsersController` | apps only; returns VO/void |
| Module | `admin-users.module.ts` | `AdminUsersModule` | wires controllers + imports |
| Guard | `permissions.guard.ts` | `PermissionsGuard` | |
| Strategy | `admin-jwt.strategy.ts` | `AdminJwtStrategy` | |
| Interceptor | `operation-log.interceptor.ts` | `OperationLogInterceptor` | |
| Filter | `all-exceptions.filter.ts` | `AllExceptionsFilter` | |
| Decorator | `public.decorator.ts` | `Public` (factory) | |
| Processor | `user-registered.processor.ts` | `UserRegisteredProcessor` | worker only |
| Schedule | `cleanup.schedule.ts` | `CleanupSchedule` | worker only |
| Migration | `<ts>-InitSchema.ts` | `InitSchema<ts>` | see MIGRATION-SPEC.md |
| Error codes | `user-error-codes.ts` | `UserErrorCode` (enum) | + `UserErrorCodeHttpStatus` |
| Factory (seed) | `user.factory.ts` | `userFactory` | test/seed data builders |
| Fixture (test) | `users.fixture.ts` | `userFixtures` (const) | plain data |
| Test (unit) | `user.service.spec.ts` | — | colocated with source |
| Test (e2e) | `auth.e2e-spec.ts` | — | under `apps/<app>/test/e2e` |
| Test (integration) | `audit-log.processor.integration.spec.ts` | — | under `test/integration` |

## Other conventions

- Aliases: import from the barrel (`@domains/identity`), not deep relative paths.
- Error codes: SCREAMING_SNAKE with a domain prefix (ERROR-CODE-SPEC.md).
- Permission codes: `<group>:<resource>:<action>` (e.g. `rbac:user:read`).
- Queue/job names: from `QUEUE_NAMES` / `JOB_NAMES`, never inline strings.
- Folders inside a lib: `entities / dto / vo / mapper / assembler / services /
  types / constants` (CONVENTIONS.md §3).
