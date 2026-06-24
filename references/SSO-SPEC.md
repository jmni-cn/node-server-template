# SSO-SPEC

Third-party single sign-on lives in `@integrations/sso`. It is an integration
layer library: it may depend on `@core`, `@platform` and `@domains` (to link an
external identity to a local user), but never on another integration or an app.

## Provider class hierarchy

Providers live in `@integrations/sso/providers` and all implement
`SsoProviderPort` (`name`, `buildAuthorizeUrl`, `exchangeCode`, `fetchUserInfo`):

```
BaseSsoProvider (abstract)
  └─ OidcSsoProvider            name 'oidc'      generic OpenID Connect
       └─ KraftonSsoProvider    name 'krafton'   EXAMPLE provider (optional)
  └─ MicrosoftSsoProvider       name 'microsoft' Entra (Azure AD) v2.0
```

- **`BaseSsoProvider`** — abstract base. Provides `httpGet` / `httpPost` built on
  global `fetch` + `AbortController` (15s timeout, `SSO_HTTP_TIMEOUT_MS`),
  `Accept: application/json`, form-vs-json content type, and on `!ok` reads the
  body text, `logger.error`s, and throws `Error(HTTP <status>: ...)`.
- **`OidcSsoProvider`** (`oidc`) — generic OIDC. Endpoints derived from `issuer`
  (`${issuer}/authorize|token|userinfo` + `${issuer}/.well-known/jwks.json`) via
  **overridable protected getters**. Adds the rigorous OIDC bits: **nonce**,
  **PKCE** (`generateCodeVerifier()` / `generateCodeChallenge()` — crypto
  base64url S256), `exchangeCodeForTokens({code, redirectUri?, codeVerifier?})`,
  and `verifyIdToken({idToken, nonce})` using `jose` `createRemoteJWKSet` +
  `jwtVerify` (checks issuer + audience=`clientId` + allowed RS/ES/PS algorithms,
  nonce match, iat-not-in-future ±300s). `buildOidcAuthorizationUrl({state, nonce,
  codeChallenge?, redirectUri?})` builds the OIDC authorize URL; the port's
  `buildAuthorizeUrl(state, redirectUri?)` remains (no nonce/PKCE) for
  compatibility.
- **`MicrosoftSsoProvider`** (`microsoft`) — Entra v2.0. authorize
  `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize`, token
  `.../oauth2/v2.0/token`, userinfo `https://graph.microsoft.com/v1.0/me`.
- **`KraftonSsoProvider`** (`krafton`) — **EXAMPLE / reference provider, safe to
  delete.** Extends `OidcSsoProvider`, overriding the endpoint getters to derive
  from `krafton.oidcHost` (`${oidcHost}/oidc/auth|token|me|jwks`, issuer
  `${oidcHost}/oidc`). Minimal generic claim normalization only — no IdP-specific
  business fields. Not wired unless `SSO_KRAFTON_*` env is configured.

### Provider registry & per-provider config

`SsoProviderService` builds and registers providers in `onModuleInit` from the
`sso` config namespace, keyed by `.name`. A provider is registered **only when
configured** (its `clientId` is non-empty). `resolve(name)` returns the
`SsoProviderPort` or throws `SSO_PROVIDER_NOT_SUPPORTED` for unknown/unconfigured
providers. The `:provider` route param selects the provider; authorize/callback
services depend only on `SsoProviderPort` and are unaffected by the concrete class.

Per-provider env (all optional; nothing breaks when unset):

| provider | env keys |
|----------|----------|
| `oidc` | `SSO_ISSUER`, `SSO_CLIENT_ID`, `SSO_CLIENT_SECRET`, `SSO_REDIRECT_URI`, `SSO_SCOPE` |
| `microsoft` | `SSO_MICROSOFT_TENANT_ID` (default `common`), `SSO_MICROSOFT_CLIENT_ID`, `SSO_MICROSOFT_CLIENT_SECRET`, `SSO_MICROSOFT_REDIRECT_URI`, `SSO_MICROSOFT_SCOPE` (default `openid profile email User.Read`) |
| `krafton` (example) | `SSO_KRAFTON_OIDC_HOST`, `SSO_KRAFTON_CLIENT_ID`, `SSO_KRAFTON_CLIENT_SECRET`, `SSO_KRAFTON_REDIRECT_URI`, `SSO_KRAFTON_SCOPE` (default `openid`), `SSO_KRAFTON_USE_PKCE` (default `false`) |

Shared: `SSO_POST_LOGIN_REDIRECT` (front-end redirect target, optional),
`SSO_LOGIN_CODE_TTL` (one-time code TTL seconds, default `60`).

### id_token verification (OIDC)

`OidcSsoProvider.verifyIdToken` fetches the IdP JWKS once (`createRemoteJWKSet`,
cached) and verifies the `id_token` with `jose.jwtVerify`: signature against JWKS,
`iss` = issuer, `aud` = `clientId`, allowed asymmetric algorithms only (RS/ES/PS —
`alg=none`/HMAC rejected), `nonce` must match the value sent at authorize time,
and `iat` must not be in the future (±300s skew). Returns the verified claims.

## Authorize / callback flow

Routes are exposed by the apps under `/sso/:provider/*` (user-api) and a parallel
admin variant:

1. **Authorize** — `GET /sso/:provider/authorize`
   - `SsoStateService.issue(provider, { redirectUri })` mints a one-time random
     `state` (`generateSecureToken()`), stores the bound payload (the
     `redirectUri`) in Redis under namespace `sso:state`, key `${provider}:${state}`,
     with a **600s TTL**, and returns the `state`.
   - `SsoAuthorizeService.buildAuthorizeRedirect(...)` (async) builds the provider
     authorize URL with that `state` and the app controller redirects the browser.
2. **Callback** — `GET /sso/:provider/callback?code=...&state=...`
   - **State CSRF validation (first)** — `SsoStateService.consume(provider, state)`
     looks up the cached payload and **deletes the key (one-time use)**. A missing
     `state` or a cache miss throws `SSO_STATE_MISMATCH`; `SsoCallbackService`
     records a `SSO_STATE_MISMATCH` **security event** (userId `null`, riskLevel
     `high`) and rethrows. The `redirectUri` used for the token exchange is the one
     **bound at authorize time** — any client-supplied `redirectUri` on the
     callback is ignored, so it cannot be tampered with.
   - Exchange `code` for tokens (`SSO_CODE_EXCHANGE_FAILED` on failure).
   - Fetch the external profile (`SSO_USERINFO_FAILED` / `SSO_PROFILE_INVALID`).
   - Link or resolve the local identity (below). The app SSO service then reloads
     the full subject, gates on `status === ACTIVE` (`ACCOUNT_DISABLED` otherwise),
     and issues a session via the **single session-issuance path**
     (`UserAuthService.establishSession` / `AdminAuthService.establishSession`),
     recording `LOGIN_SUCCESS` (metadata `{ provider, sso: true }`).

### subjectType-aware callback (`SsoCallbackService.handleCallback`)

`handleCallback(provider, code, { state?, redirectUri?, subjectType })` is
**subjectType-aware** and returns a normalized principal:
`{ user: { uid, username, passwordVersion }, isNewUser }`. The `subjectType`
selects the identity domain and the provisioning policy:

- **user-api** calls it with `subjectType: 'user'`; **admin-api** with
  `subjectType: 'admin'`.
- Identity match runs against the matching subject table:
  `ExternalIdentityService.findByProvider(subjectType, provider, providerUserId)`,
  then email match via `EndUserService.findByEmail` (user) /
  `AdminUserService.findByEmail` (admin).
- **End SSO auto-provisions**: when no identity/email match exists for
  `subjectType: 'user'`, a new `EndUser` is created (`RegisterService.register`)
  and linked (`isNewUser = true`).
- **Admin SSO never auto-provisions**: when no match exists for
  `subjectType: 'admin'`, it records a `LOGIN_FAILED` event and throws
  `SSO_ACCOUNT_NOT_FOUND` (404). Admin accounts must be created under
  `/admin/administrators` first.
- `SSO_STATE_MISMATCH` security events are recorded with the correct `subjectType`.

SSO logins use the **same session-rotation model as password login**: every
session carries a `tokenFamilyId` and stores the refresh token's SHA-256
(`tokenHash`), and the session `expiresAt` comes from `issueTokens(...).refreshExpiresAt`.
This makes SSO sessions first-class participants in refresh rotation + reuse
detection (see AUTH-SPEC.md).

External HTTP calls use a bounded timeout (`SSO_HTTP_TIMEOUT_MS`).

## One-time-code exchange (SPA-safe token handoff)

Tokens are **never** placed in a redirect URL. After a successful callback the
app SSO service does **not** return the tokens; instead it stores the issued
`AuthSession` under a single-use, short-lived (`SSO_LOGIN_CODE_TTL`, default 60s)
**one-time code** and returns `{ code }`:

- `SsoLoginCodeService.issue(payload)` → `code = generateSecureToken()`; stores
  `SsoLoginCodePayload` `{ accessToken, refreshToken, refreshExpiresAt(ISO),
  userUid }` in Redis under namespace `sso:logincode` with the configured TTL.
- `SsoLoginCodeService.consume<T>(code)` → `CacheService.getAndDel(code,
  'sso:logincode')` — an **atomic GETDEL** (Redis 6.2+, with a get-then-del
  fallback) so the code can be used exactly once (replay-safe).

Flow:

1. `GET /sso/:provider/callback` → app service issues the one-time `code`.
   - If `SSO_POST_LOGIN_REDIRECT` is set, the controller `302`-redirects to
     `${SSO_POST_LOGIN_REDIRECT}?code=<code>` (no tokens in the URL).
   - Otherwise it returns a `SsoCodeVo` `{ code }`. Route stays `@Public`.
2. `POST /sso/exchange` (`@Public`, body `ExchangeCodeDto { code }`) → app
   service `consume`s the code (or throws `SSO_CODE_INVALID` if missing/used/
   expired) and returns the `AuthSession`.
   - **user-api**: the controller sets the refresh token as an HttpOnly cookie
     (same `jwtConfig` cookie options as password login) and returns
     `AuthTokenVo { accessToken, tokenType }`.
   - **admin-api**: consistent with admin password login — returns both
     `accessToken` and `refreshToken` in the body (`AuthTokenVo`), no cookie.

This keeps tokens out of browser history / referrer headers; the front end
performs a single POST to obtain the access token (and, for the user app, the
refresh-token cookie).

## External identity linking

The external profile maps to an `ExternalIdentity` in `@domains/identity`, keyed by
`(subjectType, provider, providerUserId)` and linked to a local subject uid:

- If an `ExternalIdentity` already exists for the `subjectType` → resolve to its
  subject and issue tokens.
- Else if `profile.email` matches an existing subject in that table → link and log in.
- Else (first-time login):
  - `subjectType: 'user'` → **auto-provision** an `EndUser` and link (`isNewUser`).
  - `subjectType: 'admin'` → **no auto-provision**; throw `SSO_ACCOUNT_NOT_FOUND`.

The security-center external-account endpoints (user-api) also thread
`subjectType: 'user'` through `ExternalIdentityService.listByUser/link/unlink`.

Profile sync after login is offloaded to the worker via the `sso-sync` queue
(`JOB_NAMES.SSO_SYNC.SYNC_PROFILE`) — see QUEUE-SPEC.md.

## Error codes

`SSO_PROVIDER_NOT_FOUND`, `SSO_PROVIDER_NOT_SUPPORTED`, `SSO_STATE_INVALID`,
`SSO_STATE_MISMATCH`, `SSO_CODE_EXCHANGE_FAILED`, `SSO_CODE_INVALID`,
`SSO_USERINFO_FAILED`, `SSO_PROFILE_INVALID`, `SSO_IDENTITY_LINK_FAILED`,
`SSO_ACCOUNT_NOT_LINKED`, `SSO_ACCOUNT_NOT_FOUND`. `SSO_STATE_MISMATCH` and
`SSO_CODE_INVALID` map to HTTP 401 (CSRF / replay / invalid-or-used code);
`SSO_ACCOUNT_NOT_FOUND` (admin SSO, no auto-provision) maps to 404;
`SSO_PROVIDER_NOT_SUPPORTED` maps to 400. Registered via
`registerErrorCodeHttpStatus` (ERROR-CODE-SPEC.md).
