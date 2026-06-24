# ERROR-CODE-SPEC

All errors surface as a `BusinessException` carrying a string error **code**. The
code maps to an HTTP status via a central, extensible registry, and to an i18n
message via the key `error.<CODE>`.

## Prefix conventions

Codes are `SCREAMING_SNAKE` grouped by a domain prefix:

| Prefix | Meaning | Origin |
|--------|---------|--------|
| `SYS_` | system/internal (unknown, internal, unavailable, timeout) | `@core/common` BaseErrorCode |
| `REQ_` | request/validation (validation failed, bad body, missing param) | `@core/common` |
| `RES_` | resource (not found, already exists, conflict, deleted, in use) | `@core/common` |
| `OP_`  | operation (failed, not allowed, expired) | `@core/common` |
| `AUTH_`| auth (unauthorized, login failed, token expired/invalid, disabled) | `@core/common` / `@platform/auth` |
| `RATE_`| rate limiting | `@platform/security` |
| `TASK_`| async tasks | `@platform/task` |
| `USER_`| identity/user domain | `@domains/identity` |
| `RBAC_`| roles/permissions | `@domains/access-control` |
| `SSO_` | single sign-on | `@integrations/sso` |

## core owns only the base codes

`@core/common` exports `BaseErrorCode` (+ HTTP map) and a minimal
`CommonBusinessErrorCode`. It deliberately knows **nothing** about business
domains. Each business lib defines its own `*-error-codes.ts` enum with an
accompanying `Record<string, HttpStatus>` map.

## Registering HTTP status

A business lib registers its map into the global registry at module init:

```typescript
import { registerErrorCodeHttpStatus } from '@core/common';
import { TaskErrorCode, TaskErrorCodeHttpStatus } from './constants/task-error-codes';

registerErrorCodeHttpStatus(TaskErrorCodeHttpStatus);
```

`getHttpStatusByErrorCode(code)` resolves the status (falls back to 400 if a code
was never registered).

## Throwing

```typescript
import { BusinessException, BaseErrorCode } from '@core/common';

throw new BusinessException(BaseErrorCode.RES_NOT_FOUND);
throw new BusinessException('USER_NOT_FOUND', { uid }); // domain code + details
```

`AllExceptionsFilter` turns this into the error envelope (API-SPEC.md) and
translates `error.USER_NOT_FOUND`.

## Rules

- One enum per lib; never add domain codes to `@core` BaseErrorCode.
- Every new code needs an HTTP-status entry **and** an `error.<CODE>` i18n string.
- Throw `BusinessException`; never throw a raw `HttpException` with an ad-hoc body.
