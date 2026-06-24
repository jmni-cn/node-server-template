# @domains/identity

身份域库。提供 **双主体** 用户体系：后台管理员（`AdminUser`）与终端用户（`EndUser`）两张独立主体表，**共享** 凭证 / 会话 / 安全事件 / 第三方身份等卫星表，卫星表通过 `subjectType`（`'admin' | 'user'`）判别归属。`subjectType` 与 JWT 的 `typ` claim 一致。仅依赖 `@core/*` 与 `@platform/*`（security / queue），不依赖任何兄弟域。

## 主体类型

```ts
export type SubjectType = 'admin' | 'user';
export const SUBJECT_TYPES = ['admin', 'user'] as const;
```

位于 `types/subject-type.ts`，从 barrel 导出。

## 实体 / 表

| 实体               | 表名                   | 基类         | uidPrefix | subject_type | 关键唯一键                                  |
| ------------------ | ---------------------- | ------------ | --------- | ------------ | ------------------------------------------- |
| `AdminUser`        | `admin_users`          | `BaseEntity` | `ausr`    | —            | `username`（固定 schema，勿扩展）           |
| `EndUser`          | `end_users`            | `BaseEntity` | `eusr`    | —            | `username` / `email` / `phone`（可扩展）    |
| `UserProfile`      | `user_profiles`        | `BaseEntity` | `uprf`    | —（END-ONLY）| `user_id` 唯一（EndUser uid）               |
| `UserCredential`   | `user_credentials`     | `BaseEntity` | `ucrd`    | ✅           | UNIQUE(`subject_type`,`user_id`)            |
| `UserSession`      | `user_sessions`        | `BaseEntity` | `ses`     | ✅           | UNIQUE(`subject_type`,`user_id`,`jti`)      |
| `SecurityEvent`    | `user_security_events` | `BaseEntity` | `sev`     | ✅           | IDX(`subject_type`,`user_id`,`event_type`)  |
| `ExternalIdentity` | `external_identities`  | `BaseEntity` | `eid`     | ✅           | UNIQUE(`subject_type`,`provider`,`providerUserId`) |

- `AdminUser`：`username`（唯一）、`email`（可空）、`status`、`passwordVersion`、`lastLoginAt/Ip`。固定 schema，业务字段勿写此表。
- `EndUser`：`username`/`email`/`phone`（均唯一可空）、`status`、`passwordVersion`、`lastLoginAt/Ip`。业务可扩展字段写在标注区块。
- `UserProfile`：仅服务 `EndUser`，`userId`=EndUser uid（唯一）。管理员不使用资料表。

## 服务（wave 2 契约）

- `AdminUserService`：`create`、`findByUid`、`findByUsername`、`findByEmail`、`list(PaginationDto)`、`update`、`updateLastLogin(uid, ip?)`、`changePassword(uid, ChangePasswordDto)`。
- `EndUserService`：`create`、`findByUid`、`findByUsername`、`findByEmail`、`findByPhone`、`getDetail(uid)`、`list`、`update`、`updateLastLogin`、`incrementPasswordVersion`。
- `CredentialService`：`setPassword(subjectType, userId, plain)`、`verify(subjectType, userId, plain): boolean`、`exists(subjectType, userId)`。
- `LoginService`：`verifyCredentials(subjectType, identifier, password, ctx?)` → `AuthenticatedPrincipal`（**不签发令牌**）。
- `RegisterService`（END-ONLY）：`register(dto)` → `EndUser`。
- `ProfileService`（END-ONLY）：`getByUserId`、`getDetail(endUserUid)`、`update(endUserUid, dto)`、`changePassword(endUserUid, dto)`。
- `SessionService`（全部方法 subjectType 感知）：`create({subjectType,...})`、`findByUserAndJti(subjectType,userId,jti)`、`findByUid(uid)`、`revoke(uid,reason?)`、`revokeByUser(subjectType,userId,uid)`、`revokeAllForUser(subjectType,userId,reason?)`、`revokeTokenFamily(subjectType,userId,familyId,reason?)`、`touchSession(subjectType,userId,jti)`、`rotateSession({subjectType,...})`、`validateRefreshSession({subjectType,...})`、`listActiveByUser(subjectType,userId,currentJti?)`。
- `SecurityEventService`：`record({subjectType?,userId?,...})`、`listBySubject(subjectType, userId, PaginationDto)`。
- `ExternalIdentityService`：`findByProvider(subjectType,provider,providerUserId)`、`listByUser(subjectType,userId)`、`link({subjectType,userId,...})`、`unlink(subjectType,userId,uid)`。
- `EndUserAssembler`：`toDetailVo(EndUser)` → `EndUserDetailVo`（注入 UserProfile 仓储做只读关联，避免循环依赖）。

`AuthenticatedPrincipal = { uid; username: string|null; passwordVersion; status }`（`types`）。

## 队列 / 事件

- 队列：`QUEUE_NAMES.USER_EVENTS`（`'user-events'`）。
- Job：`USER_REGISTERED` / `USER_LOGGED_IN` / `PASSWORD_CHANGED`。负载 `UserEventJobData { sub, username }`。

## 错误码

`USER_NOT_FOUND` / `ADMIN_NOT_FOUND` / `END_USER_NOT_FOUND` / `USER_CREDENTIAL_NOT_FOUND` / `USER_PROFILE_NOT_FOUND` / `USER_SESSION_NOT_FOUND` / `USER_EXTERNAL_IDENTITY_NOT_FOUND`（404）、`USER_USERNAME_TAKEN` / `USER_EMAIL_TAKEN` / `USER_PHONE_TAKEN` / `USER_EXTERNAL_IDENTITY_LINKED`（409）、`USER_DISABLED`（403）、`INVALID_CREDENTIALS` / `USER_PASSWORD_INCORRECT` / 会话安全类（401）。模块加载时通过 `registerErrorCodeHttpStatus` 注册映射。
