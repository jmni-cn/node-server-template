# @platform/security

Security infrastructure for the platform: rate limiting, IP blacklisting,
password hashing/policy and device info parsing.

Import `SecurityModule` (it depends on the global `CacheModule` for
`RedisService`, and on `LoggerModule`).

## Decorators

- `@RateLimit({ windowMs, max, keyBy })` — declare a per-route rate limit.
  `keyBy` is one of `'ip' | 'user' | 'ip-path'` (default `'ip-path'`).

## Guards

- `RateLimitGuard` — enforces `@RateLimit` metadata; sets `X-RateLimit-Limit`,
  `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers; throws
  `RATE_LIMIT_EXCEEDED` (429) when over the limit.
- `IpBlacklistGuard` — rejects requests from blacklisted IPs with
  `IP_BLACKLISTED` (403). IP is read from `RequestContextService`.

## Services

- `RateLimitService.hit(key, windowMs, max)` — fixed-window limiter (Redis
  `INCR` + `EXPIRE`). Returns `{ allowed, remaining, resetInSeconds }`.
- `PasswordHasherService.hash(plain)` / `.compare(plain, hash)` — bcrypt.
- `PasswordPolicyService.validate(password)` (throws `SEC_PASSWORD_TOO_WEAK`)
  and `.check(password)` (non-throwing). Configurable via constructor options.
- `DeviceInfoService.parse(userAgent?, ip?)` / `.fromContext()` — normalized
  `DeviceInfo` via `ua-parser-js`.
- `IpBlacklistService.block(ip, reason, ttlSeconds?)` / `.unblock(ip)` /
  `.isBlocked(ip)` / `.ttl(ip)`.

## Usage

```typescript
@RateLimit({ windowMs: 60_000, max: 10, keyBy: 'ip' })
@UseGuards(RateLimitGuard)
@Post('login')
async login() {}
```
