# AUTH-SPEC

Authentication and authorization live in `@platform/auth`. The library is
domain-agnostic: it signs/verifies tokens, runs passport strategies and guards,
and defines the `ACCESS_CHECKER` port. The concrete permission lookup is provided
by `@domains/access-control` and bound by the app.

## Two principals, two user tables, separate token spaces

Identity is split into **two distinct subject tables** (`SubjectType = 'admin' | 'user'`):

- **admin** — staff of the management backend (admin-api). Stored in **`admin_users`**
  (`AdminUser`). Tokens carry the admin subject and (resolved) `roleUids` +
  `permissionCodes`. Admin accounts always have a `username`.
- **user** — end users (user-api). Stored in **`end_users`** (`EndUser`, plus an
  end-only `UserProfile`). Tokens carry the user subject; no RBAC permissions.
  `username` is nullable (SSO-provisioned users may not set one).

The **shared satellite tables** — `UserCredential`, `UserSession`, `SecurityEvent`,
`ExternalIdentity` — carry a `subjectType` column and are keyed by
`(subjectType, userId)`. Every domain method that touches them is **subjectType-aware**
(e.g. `SessionService.create({ subjectType, ... })`,
`CredentialService.verify(subjectType, userId, plain)`,
`ExternalIdentityService.listByUser(subjectType, userId)`,
`SecurityEventService.listBySubject(subjectType, userId, pagination)`).
`LoginService.verifyCredentials(subjectType, identifier, password, ctx?)` returns a
normalized `AuthenticatedPrincipal` (`{ uid, username, passwordVersion, status }`),
so the app/auth layer never depends on the concrete entity.

Admin and user tokens are validated by **separate strategies** so a user token
can never satisfy an admin route and vice versa. `subjectType` is fixed per app:
admin-api threads `'admin'` everywhere, user-api threads `'user'` everywhere.

## Account management split (admin-api)

- **`/admin/users`** manages **end users** (`EndUserService`): list / detail /
  update (incl. disable via `status`). Returns `EndUserVo` / `EndUserDetailVo`.
  Guarded by `@Permissions('rbac:user:*')`.
- **`/admin/administrators`** manages **admin accounts** (`AdministratorsService`
  orchestrating `AdminUserService` + `RoleService` + `CredentialService` +
  `SessionService`): create / list / detail (with role uids) / update / assign-roles /
  reset-password (resets the credential, bumps `pv`, revokes the admin's sessions).
  Guarded by `@Permissions('rbac:admin:*')` — seed codes
  `rbac:admin:read|create|update|delete`.

## Access + refresh tokens

- **Access token (AT)** — short-lived (`JWT_ACCESS_EXPIRES_IN`, default 15m), signed
  with `JWT_ACCESS_SECRET`. Sent as `Authorization: Bearer <token>`. Returned in the
  response body.
- **Refresh token (RT)** — long-lived (`JWT_REFRESH_EXPIRES_IN`, default 7d), signed
  with `JWT_REFRESH_SECRET`. **Delivered as an HttpOnly cookie** (`refresh_token`,
  `SameSite`/`Secure`/`Domain` from `jwtConfig`) — never in the response body. The
  refresh strategy also accepts `Authorization: Bearer <rt>` for non-browser clients.
- Logout / rotation revokes the session and blacklists the AT jti in `@platform/auth`.
- **Remember-me** — login DTOs (`LoginDto`, `AdminLoginDto`) accept an optional
  `remember?: boolean`. When set, `TokenService.issueTokens({ ..., remember: true })`
  uses the longer `jwtConfig.rememberAccessExpiresIn` / `rememberRefreshExpiresIn`
  (env `JWT_REMEMBER_ACCESS_EXPIRES_IN` / `JWT_REMEMBER_REFRESH_EXPIRES_IN`, default
  refresh `30d`) instead of the standard expiries. The persisted session's
  `expiresAt` and the RT cookie expiry both derive from
  `issueTokens(...).refreshExpiresAt`, so remember-me consistently extends the
  whole session — there is no hard-coded session TTL anywhere.

Payload subject is the user **uid** (`sub`); `jti` is the session id; `pv` is the
password version. Do not put sensitive data in the token.

### Single session-issuance path (`establishSession`)

All post-authentication session creation goes through **one** application-service
method per app: `UserAuthService.establishSession(user, { remember? })` and
`AdminAuthService.establishSession(adminUser, { remember?, roleUids, permissionCodes })`.
It generates `jti` + `tokenFamilyId`, calls `TokenService.issueTokens(...)`
(honoring `remember`), persists the session via `SessionService.create(...)` with
`expiresAt = issueTokens(...).refreshExpiresAt` and the RT `tokenHash`, and returns
the plain `AuthSession` (`{ accessToken, refreshToken, refreshExpiresAt }`).
Password login/register and **SSO callbacks** all reuse this single path, so every
session — regardless of how the user authenticated — is created identically and
participates in rotation + reuse detection. `establishSession` does **not** record
`LOGIN_SUCCESS`; the auth-decision site (password login service, or the SSO app
service after the status gate) records it.

## Session security model (`@domains/identity` SessionService)

Every login creates a `user_sessions` row keyed by `(userId, jti)` that stores the
RT's **`tokenHash` (SHA256 of the RT plaintext)**, a **`tokenFamilyId`** shared by the
whole rotation chain, `refreshCount`, `expiresAt`, `revokedAt`/`revokedReason`,
`lastSeenAt`, and device/ip/ua/geo metadata. The RT plaintext is never stored.

### Rotation + token-family reuse detection

`POST /auth/refresh` (Public + `RefreshJwtAuthGuard`, rate-limited). **Both apps run
the same rigorous flow** — admin-api reloads the `AdminUser` via
`AdminUserService.findByUid` and re-resolves `roleUids`/`permissionCodes` before
re-issuing; user-api reloads the `EndUser` via `EndUserService.findByUid`:

1. Load the subject; reject if `status !== ACTIVE` (`ACCOUNT_DISABLED`, 403).
2. Reject if `subject.passwordVersion !== payload.pv` (`PASSWORD_VERSION_MISMATCH`, 401).
3. `validateRefreshSession({ subjectType, userId, jti, rawToken })`:
   - session missing -> `SESSION_INVALID` (401).
   - session revoked with `reason='rotated'` -> a previously-rotated RT is being
     replayed = **token theft**: `revokeTokenFamily(userId, tokenFamilyId)` revokes the
     entire chain, a `REFRESH_REUSE_DETECTED` (critical) security event is recorded, and
     the request is rejected (401).
   - session revoked for any other reason -> `SESSION_INVALID` (401).
   - expired -> `SESSION_EXPIRED` (401).
   - `tokenHash` ≠ `sha256(rawToken)` -> `TOKEN_INVALID` (401, tamper).
4. `rotateSession({ subjectType, ... })`: mark the old session `revokedReason='rotated'`,
   create a NEW session with the **same `tokenFamilyId`**, a new `jti`+`tokenHash`,
   `refreshCount+1`.
5. Set a fresh RT cookie, record `REFRESH_SUCCESS` (with `subjectType`), return the new AT.

### Password-version invalidation

`PUT /users/me/password` increments `user.passwordVersion`, calls
`revokeAllForUser(userId, 'password_changed')`, and records `PASSWORD_CHANGED`. Any AT/RT
carrying the old `pv` is then rejected at refresh time.

### Status gating

`verifyCredentials` rejects any non-`ACTIVE` status (`disabled`/`locked`/`banned`).
Refresh re-checks status on every call.

## Security-event audit trail (`user_security_events`)

`SecurityEventService.record({ subjectType?, userId?, deviceId?, sessionUid?, eventType,
riskLevel?, ip?, userAgent?, metadata? })` persists an audit row with the **IP masked**
and the **User-Agent hashed** (`@core/common` `maskIp` / `hashUserAgent`). Per-subject
listing is `listBySubject(subjectType, userId, pagination)`. Recording never throws
— failures are logged and swallowed so they cannot break the auth flow. Event types:
`LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `LOGOUT_ALL`, `REFRESH_SUCCESS`,
`REFRESH_REUSE_DETECTED`, `SESSION_REVOKED`, `PASSWORD_CHANGED`, `SSO_STATE_MISMATCH`.
Risk levels: `low` / `medium` / `high` / `critical`.

## Strategies and guards

- Passport strategies: `admin-jwt`, `user-jwt`, `refresh-jwt`.
- A global JWT guard protects every route by default. `@Public()` opens a route
  (login, register, sso callback, health).
- `PermissionsGuard` enforces `@Permissions('rbac:user:read', ...)` on admin
  routes. It resolves the principal's permissions through the `ACCESS_CHECKER`.

## ACCESS_CHECKER port

`@platform/auth` exports the `ACCESS_CHECKER` injection token. The app binds an
implementation (from `@domains/access-control`) in its module:

```typescript
{
  provide: ACCESS_CHECKER,
  useExisting: AccessControlChecker, // from @domains/access-control
}
```

`PermissionsGuard` calls `accessChecker.hasPermissions(principal, required)`. This
keeps `@platform/auth` free of any RBAC table knowledge (LAYER-SPEC.md).

## Decorators (apps)

- `@Public()` — bypass the JWT guard.
- `@CurrentUser()` / `@CurrentAdminUser()` — read the authenticated principal
  (optionally a single field: `@CurrentAdminUser('sub')`).
- `@Permissions(...)` — required permission codes (admin only).
- `@RateLimit({...})` — throttle login/register/refresh/sso (SECURITY → RATE_).

## Permission code convention

`<group>:<resource>:<action>`, e.g. `rbac:user:read`, `rbac:role:write`.
