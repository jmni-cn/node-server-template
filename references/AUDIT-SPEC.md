# AUDIT-SPEC

Operation logging (audit) lives in `@platform/audit`. Every write endpoint is
annotated; an interceptor captures the operation and offloads persistence to the
worker through the queue. The request path never blocks on writing the audit row.

## Decorate writes

Apply `@OperationLogDecorator({ action, module, resource? })` to every write
(POST/PUT/PATCH/DELETE) controller method:

```typescript
@Post()
@OperationLogDecorator({ action: 'CREATE_USER', module: 'Users' })
async create(@Body() dto: CreateUserDto): Promise<UserVo> { ... }
```

- `action` — verb-noun, SCREAMING_SNAKE (e.g. `CREATE_USER`, `UPDATE_ROLE`).
- `module` — the feature area (e.g. `Users`, `Roles`).
- `resource` — optional identifier of the affected resource.

> Note on naming: the metadata decorator is the entity-name-clashing `OperationLog`
> internally; it is exported as **`OperationLogDecorator`** from `@platform/audit`
> (the `OperationLog` entity keeps the bare name). Always import the decorator
> name.

## Capture → queue → persist

1. `OperationLogInterceptor` reads the `@OperationLogDecorator` metadata, captures
   request context (principal uid/username, ip, ua, path, method, result/status)
   from `@core/request-context`, and enqueues
   `JOB_NAMES.AUDIT.WRITE_OPERATION_LOG` on `QUEUE_NAMES.AUDIT`.
2. The worker's `AuditLogProcessor` consumes the job and calls
   `OperationLogService.persistFromJob(payload)` to write the `OperationLog` row.

This keeps audit writes off the request hot path and resilient to brief DB load.

## Query

admin-api exposes `/admin/operation-logs` (read-only, paginated) to browse audit
records. Logs are immutable — there is no update/delete endpoint.

## Rules

- A write endpoint without `@OperationLogDecorator` is a review red flag.
- The interceptor enqueues; it never writes the DB synchronously.
- Audit payloads are plain serializable objects (QUEUE-SPEC.md). Mask sensitive
  fields (passwords, tokens) using the masking utils in `@core/common` before
  they reach the log.
