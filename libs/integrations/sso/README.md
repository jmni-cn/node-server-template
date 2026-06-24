# @integrations/sso

第三方 **OAuth2 / OIDC 单点登录（SSO）** 集成库。

作为 integration，本库可依赖 `@core/*`、`@platform/*`、`@domains/*`；不依赖其他
integration、app 或 `@libs/*`。SSO 自身不持久化任何实体，身份绑定复用
`@domains/identity` 的 `ExternalIdentity`。

## Providers（类层级）

`providers/` 下均实现 `SsoProviderPort`：

```
BaseSsoProvider (abstract, fetch + AbortController httpGet/httpPost)
  └─ OidcSsoProvider          name 'oidc'      通用 OIDC（nonce / PKCE / id_token JWKS 验签）
       └─ KraftonSsoProvider  name 'krafton'   示例 provider（可删除）
  └─ MicrosoftSsoProvider     name 'microsoft' Entra v2.0
```

- `OidcSsoProvider` 端点由 `issuer` 推导（可被子类覆盖的 protected getter）；
  提供 `buildOidcAuthorizationUrl` / `exchangeCodeForTokens` / `verifyIdToken`
  （`jose` `createRemoteJWKSet` + `jwtVerify`，校验 iss/aud/算法/nonce/iat）与
  PKCE `generateCodeVerifier` / `generateCodeChallenge`。
- `SsoProviderService` 在 `onModuleInit` 时按各 provider 配置块构造并注册（缺省
  `clientId` 的 provider 不入册），`resolve(name)` 未配置/未知抛
  `SSO_PROVIDER_NOT_SUPPORTED`。
- 配置见 `@core/config` 的 `ssoConfig`（通用 + `microsoft` + `krafton` 块）。

## 一次性登录码

`SsoLoginCodeService`：回调成功后把 `SsoLoginCodePayload`（access/refresh/
refreshExpiresAt/userUid）写入一次性 code（命名空间 `sso:logincode`，TTL =
`ssoConfig.loginCodeTtl`，默认 60s）；`consume(code)` 经 `CacheService.getAndDel`
原子读取并失效。前端凭 code 调 `POST /sso/exchange` 换取 access token。

## 流程：authorize → callback

1. **authorize**：`SsoAuthorizeService.buildAuthorizeRedirect(provider, { redirectUri?, state? })`
   生成随机 `state`（`crypto.randomUUID()`）与跳转 URL。
   > state 的持久化与回调校验是 **应用层** 职责（防 CSRF）：应用应存储返回的 state，
   > 在回调时比对。
2. **callback**：`SsoCallbackService.handleCallback(provider, code, { state?, redirectUri?, subjectType })`
   —— **subjectType 感知**（`'admin' | 'user'`）：
   - `exchangeCode` 换 token → `fetchUserInfo` 拉取原始资料 →
     `ProviderProfileNormalizerService.normalize` 归一化为 `NormalizedProfile`。
   - 身份匹配策略（按 `subjectType` 分别落在对应主体表，二者**不共用规则**）：
     - `admin`（**绝不自动开户**）：
       1. `ExternalIdentity(admin, provider, providerUserId)` 命中 → 直接登录；
       2. 否则 `profile.email` 命中已有管理员 → 绑定外部身份后登录；
       3. 否则 → 抛 `SSO_ACCOUNT_NOT_FOUND`。
     - `user`（`providerUserId` 为**唯一稳定关联键**，**不做邮箱匹配/合并**）：
       1. `ExternalIdentity(user, provider, providerUserId)` 命中 → 直接登录；
       2. 否则 → 由 provider 资料开户新 `EndUser`（`RegisterService.registerFromSso`，
          初始化 `username/nickname/email`）并绑定（`isNewUser = true`，
          provider 昵称快照落 `ExternalIdentity.providerNickname`）。
   - 返回 `{ user: { uid, username, passwordVersion }, isNewUser }`（规范化主体）。

## 身份绑定（identity linking）

通过 `@domains/identity`（均 subjectType 感知）：
- `ExternalIdentityService.findByProvider(subjectType, provider, providerUserId)`
- `ExternalIdentityService.link({ subjectType, userId, provider, providerUserId, raw })`
- `AdminUserService.findByUid / findByEmail`（admin）、`EndUserService.findByUid`（user）、`RegisterService.registerFromSso`（仅 user 开户，按 providerUserId）

绑定失败统一抛 `BusinessException(SSO_IDENTITY_LINK_FAILED)`。

## SSO_SYNC 入队

回调成功后入队资料同步任务（异步对账 / 补全）：

```ts
queueProducer.enqueue(
  QUEUE_NAMES.SSO_SYNC,          // 'sso-sync'
  JOB_NAMES.SSO_SYNC.SYNC_PROFILE, // 'sync-profile'
  { provider, externalId: profile.providerUserId, sub: user.uid } satisfies SsoSyncJobData,
);
```

## 错误码

`SsoErrorCode`（value === key），HTTP 映射经 `registerErrorCodeHttpStatus(SsoErrorCodeHttpStatus)`
在模块加载时注册：

| code                       | HTTP |
| -------------------------- | ---- |
| `SSO_PROVIDER_NOT_FOUND`   | 404  |
| `SSO_ACCOUNT_NOT_LINKED`   | 404  |
| `SSO_STATE_INVALID`        | 400  |
| `SSO_PROFILE_INVALID`      | 400  |
| `SSO_CODE_EXCHANGE_FAILED` | 502  |
| `SSO_USERINFO_FAILED`      | 502  |
| `SSO_IDENTITY_LINK_FAILED` | 502  |

## 用法

```ts
import { SsoModule } from '@integrations/sso';

@Module({ imports: [SsoModule] })
export class AppModule {}
```

导出：`SsoProviderService`、`SsoAuthorizeService`、`SsoCallbackService`、
`ProviderProfileNormalizerService`。
