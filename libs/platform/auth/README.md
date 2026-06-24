# @platform/auth

Platform authentication infrastructure for the NestJS monorepo.

## What it provides

- **Token service** (`TokenService`) — sign / verify / decode Access & Refresh tokens, plus payload builders (`buildAdminPayload`, `buildUserPayload`, `buildRefreshPayload`). Secrets and expirations come from `jwtConfig` (`@core/config`).
- **Token blacklist** (`TokenBlacklistService`) — Redis-backed revocation by `jti` (`auth:blacklist:<jti>`).
- **Passport strategies** — `AdminJwtStrategy` (`admin-jwt`), `UserJwtStrategy` (`user-jwt`), `RefreshJwtStrategy` (`refresh-jwt`).
- **Guards** — `AdminJwtAuthGuard`, `UserJwtAuthGuard`, `RefreshJwtAuthGuard`, `PermissionsGuard`.
- **Decorators** — `@Public()`, `@CurrentUser()`, `@CurrentAdminUser()`, `@Permissions()`.
- **Types** — `AdminJwtPayload`, `UserJwtPayload`, `RefreshTokenPayload`, `AdminAuthUser`, `UserAuthUser`, `RefreshAuthUser`, etc.
- **Error codes** — `AuthErrorCode` (AUTH_/TOKEN_/SESSION_/PWD_/PERM_ groups), auto-registered with HTTP status mapping on module load.

## Layering

May import `@core/*` and sibling `@platform/*` libs. MUST NOT import `@domains/*`, `@integrations/*`, or any app.

## Strategy names

| Strategy             | Passport name | Secret               | Token source                              |
| -------------------- | ------------- | -------------------- | ----------------------------------------- |
| `AdminJwtStrategy`   | `admin-jwt`   | `accessSecret`       | `Authorization: Bearer`                   |
| `UserJwtStrategy`    | `user-jwt`    | `accessSecret`       | `Authorization: Bearer`                   |
| `RefreshJwtStrategy` | `refresh-jwt` | `refreshSecret`      | `Authorization: Bearer` or `refresh_token` cookie |

## The ACCESS_CHECKER contract

`PermissionsGuard` does not depend on `@domains/*`. It delegates permission
resolution to an injected port:

```typescript
export interface AccessChecker {
  hasPermissions(userId: string, perms: string[]): Promise<boolean>;
}

export const ACCESS_CHECKER = Symbol('ACCESS_CHECKER');
```

The consuming app must provide an implementation.

## Wiring

```typescript
import { ACCESS_CHECKER, AuthModule, type AccessChecker } from '@platform/auth';

@Injectable()
class RbacAccessChecker implements AccessChecker {
  // resolve permissions from your RBAC domain
  async hasPermissions(userId: string, perms: string[]): Promise<boolean> {
    /* ... */
    return true;
  }
}

@Module({
  imports: [AuthModule.forRoot()],
  providers: [{ provide: ACCESS_CHECKER, useClass: RbacAccessChecker }],
})
export class AppAuthModule {}
```

Then on controllers:

```typescript
@UseGuards(AdminJwtAuthGuard, PermissionsGuard)
@Permissions('user.read')
@Get('users')
listUsers(@CurrentAdminUser() user: AdminAuthUser) { /* ... */ }
```
