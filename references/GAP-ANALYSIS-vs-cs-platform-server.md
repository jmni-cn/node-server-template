# 模板对比审计报告：node-server-template vs cs-platform-server

> 目的：再次"取长补短"——对照成熟项目 `cs-platform-server`，逐项找出 `node-server-template` 在
> **业务逻辑严密性、安全漏洞、审计与日志完整性** 上的不足，给出可执行的修复清单。
>
> 结论一句话：**模板的架构方向整体优于 cs（admin/user 分离、OIDC 通用验签、缓存分层、限流多维、core 不绑业务码），
> 但当前磁盘上的代码大面积截断、关键安全链路"有轮子没装上"，必须先恢复完整性，再补严密性。**

---

## 0. 重要更正：「文件截断」是沙箱挂载读取 BUG，并非真实问题

> ⚠️ 本报告初版（由并行子审计生成）曾判定「约 112/433 文件被截断、项目无法编译（P0）」。
> **此结论已被推翻、作废。**

经用文件工具（直接读取真实磁盘路径）逐个复核：

- `token.service.ts` 真实为 **188 行完整文件**（含 `verifyRefreshToken`/`buildAdminPayload`/`buildUserPayload`/`buildRefreshPayload`/`decode` 全部方法）；通过 Linux 沙箱挂载读取时却只返回 108 行半截内容。
- `session.service.ts` 的 `rotateSession`/`validateRefreshSession`/`revokeTokenFamily` **真实存在**（约 140–233 行）。
- 即 **磁盘上的源文件是完整的**；是子审计所用的沙箱挂载返回了陈旧/截断内容，导致大量"方法不存在/文件截断/未编译"的**假阴性**。

**因此对本报告的使用方式更正为：**
1. 所有"X 方法不存在 / 文件被截断 / 无法编译"类结论 **一律不可信**，需在真实文件上复核后再采纳。
2. 所有"X 已实现但未接线 / 逻辑分支缺失 / 字段缺失"类结论，多数引用了具体行号与方法体（来自可靠的文件读取），**可信度较高，但仍逐项在真实文件上确认后再改**。
3. 不存在 P0 恢复工作，直接进入 P1/P2/P3 的"逐项核验 + 修复"。

### 已在真实文件上确认为「真实存在的缺口」（示例，应修）
- 审计 `operation-log.interceptor.sanitizeParams()` 仅 `JSON.parse(JSON.stringify())`，**未脱敏**。
- `user-jwt.strategy.validate()` 仅映射 payload，**不校验会话/pv/状态/黑名单/typ**。
- `TokenBlacklistService.isBlacklisted()` 已定义但**全仓库无调用方**。
- identity 域**未引用 `PasswordPolicy`**（注册/改密未接线）。

### 已在真实文件上确认为「假阴性、实际已存在」（不要改）
- `session.service` 的 `rotateSession`/`validateRefreshSession`/`revokeTokenFamily` 已实现。
- `token.service` 的全部签发/校验/payload 组装/解码方法已实现。

> 注意：因沙箱挂载不可靠，**无法在沙箱内 `tsc`/跑测试编译校验**；修复以真实文件读取 + 谨慎编辑为准，未能机器编译校验处会单独标注。

---

## ★★★★★★★★ 第八轮：配置解析简化为两层（砍掉 env，2026-06-26）

修订第六/七轮的「代码默认→env→DB」三层模型为**两层:DB 覆盖 → 代码默认(注册表)**——对这些热更新业务键而言 env 中间层无实义,代码默认即基线。

- `RuntimeConfigService.resolveWithSource` 去掉 env 解析(删 `resolveFromEnv`/`toEnvKey`),来源仅剩 `db / code_default / disabled_fallback / error_fallback`;`ResolvedConfig.envKey` 与 `ConfigSource.'env'` 删除。
- `ConfigDefinition` 去掉 `envFallbackKey`;security/sso/task 三处定义注册同步去掉该字段。
- 删除 `@core/config` 的 **securityConfig 命名空间 + Joi**(login/IP 阈值默认改由注册表提供);`ssoConfig` 去掉 `allowAutoRegister/allowedEmailDomains` 两个策略键的 env(**保留** clientId/secret/issuer/endpoints/scope/redirectUri 等基础设施 env)。
- `sso-callback` 不再传 env 默认,直接 `getBoolean/getJson(KEY)` 由注册表供默认;其 ssoConfig 注入因不再使用而移除。
- 连带清理:`config-definition.vo`/`getDefinitions` 去掉 env 字段;env 示例文件移除已失效的 LOGIN_MAX_FAILED 等变量。
- **机密/基础设施 env 完全不动**(APP/DB/Redis/JWT 密钥/盐/CORS/Logging)。
- 定义入库策略:**保持懒加载**——注册表(内存)是代码默认单一事实源,DB 只存运行期覆盖,后台 `GET definitions` 目录端点提供全量可见性;不把默认 seed 进 DB(避免重复/漂移)。

Grep 核验:全仓无残留 `envFallbackKey/resolveFromEnv/toEnvKey/securityConfig`。`@platform/config` 仍仅依赖 `@platform/cache`+`@core/database`。

### 合并前人工验证
`pnpm typecheck && pnpm build`(重点:securityConfig 删除后无悬空 import、sso-callback 去 ssoConfig 注入后 DI 正常);实测:无 DB 行时读取得代码默认;写 DB 行→即时覆盖;后台 disable 该行→回落代码默认。

---

## ★★★★★★★ 第七轮：配置热更新精修（2026-06-26）

按用户三点指示精修第六轮成果，并按 CLAUDE.md 复检（结论：三项改动正确自洽，未破坏任何架构不变量，热更新链路完整）：

1. **去掉进程内缓存,纯 Redis + 写时失效**:`RuntimeConfigService` 移除 processCache/PROCESS_TTL 等,`loadFromDb` 改 Redis→DB 两段(保留 Redis 负缓存防穿透),`invalidate` 只清 Redis。多实例下写时失效即时一致(不再有 ≤30s 进程内陈旧窗口)。
2. **admin-api 配置 CRUD 补全 + 审计 + 权限**:经核实控制器此前已存在(分页列表/upsert/软删,带 `sys:config:*` 权限 + `@OperationLogDecorator` 审计);补了 `GET :key 详情` 与 `GET definitions`(定义目录:键/默认/来源/业务含义,机密脱敏);权限码 `sys:config:read/create/update/delete` 已 seed 并随 SUPER_ADMIN 全量绑定。又补:`SetConfigDto` 增 `enabled/label/sort` 并在 `set` 透传——管理员可从后台启用/禁用某条 DB 覆盖(disable=回落 env/默认)及改标签/排序。
3. **消除硬编码 key**:各 lib 导出 `SECURITY_CONFIG_KEYS / SSO_CONFIG_KEYS / TASK_CONFIG_KEYS` 常量(constants/config-keys.ts),定义注册与消费方(login/ip-blacklist/sso-callback/task)统一引用常量;消费方内联默认值多数删除、交由注册表单一来源(SSO 因 env 解析默认有意保留)。

复检另记两条非阻断项:① 配置定义目录接口对每个 key 串行解析(去内存层后每次走 Redis),键多时多几次 Redis 读,功能正确;② 机密键拒写/只读拒改/VO 脱敏均成立。

### 合并前人工验证
`pnpm typecheck && pnpm build`;实测:改 `system_configs` 某键即时生效(多实例下也即时,因纯 Redis);后台 disable 某键后读取回落 env/默认;机密键后台改/写被拒。

---

## ★★★★★★ 第六轮：业务/安全配置热更新（@platform/config，2026-06-26）

协作式决策后落地"运行时可热更新配置"。划分原则：**机密/引导期/启动期绑定 → 留 env;运行期业务策略 → DB 可热更新**,且 env 不删,做成**分层覆盖:代码默认 → env → DB(最高优先)**。

- **新建低层库 `@platform/config`**(非全局,消费 lib 各自显式 import):
  - `SystemConfig` 实体从 domains/system 迁入(表名仍 `system_configs`),增列 `enabled/is_secret/is_public/is_editable/source/label/sort`,并入单一 InitSchema(无新增迁移)。
  - `RuntimeConfigService`:`getBoolean/getNumber/getString/getJson(key, default?)` 异步 fail-safe(异常回退默认、绝不抛);`resolveWithSource`(来源追踪 db/env/code_default/disabled_fallback/error_fallback);进程内短 TTL + Redis + 负缓存;`set/delete` 写时失效;机密键拒写 DB。
  - `ConfigDefinition` 类型 + `registerConfigDefinitions()` 全局注册表(仿 registerErrorCodeHttpStatus):每键声明 valueType/默认值/envFallbackKey/业务含义。
- **各 lib 注册自己的定义**:security(`security.login.*`/`security.ip.*`)、sso(`sso.policy.allow_auto_register`/`allowed_email_domains`)、task(`task.reliability.*`),默认值与原硬编码一致。
- **消费方改读**(async,已补 await):login.service、ip-blacklist.service、sso-callback.service、task.service 从注入 env 命名空间改为 `RuntimeConfigService.getXxx(key, 默认)`;env 命名空间(jwt/security/sso)+ Joi 保留作启动校验与回退层。
- **domains/system 退为后台管理壳**:list/分页自读;set/delete 委托 RuntimeConfigService 集中失效;VO 增 enabled/isSecret/...;机密项脱敏、isEditable=false 拒改(新增 `SYS_CFG_NOT_EDITABLE`)。
- **分层/循环依赖**:`@platform/config` 仅依赖 `@platform/cache`+`@core/database`,不依赖 domains/integrations(已核验无环);各消费 lib 单向依赖它。

### 合并前人工验证
`pnpm typecheck && pnpm build`;启动验证:改 `system_configs` 里 `security.login.max_failed` 后**无需重启**即生效(写时失效 + 短 TTL);`resolveWithSource` 能看出值来自 db/env/default;机密键拒写;实体迁移后 autoLoadEntities 与 CLI glob 仍只注册一次 SystemConfig。**一个边界**:RuntimeConfigService.set 对 STRING+null 会落库为字符串 "null"(原 domains/system 直存 DB null),影响面极小(无此类配置),如需可在 set 对 null 特判。

---

## ★★★★★ 第五轮：协作式决策落地（2026-06-26）

本轮改为「先列方案、由用户拍板，再实现」。用户逐项决策后实现如下：

- **审计字段入库 = 混合**：订阅器兜底常规 save 路径 + 批量/QueryBuilder 写在调用点显式从 RequestContext 补（约定，已写入订阅器注释）。**作用范围**：白名单表 `admin_users / end_users / roles / permissions / menus / dictionaries / dictionary_items / system_configs`（其它高频/流水表不回填）。
- **会话策略 = 显式枚举 `SESSION_POLICY=replace|limit`，默认 replace（全局单会话）**：登录建会话后作废该主体其它所有活跃会话（reason `replaced_by_new_login` + 记 SESSION_REVOKED）；`maxActiveSessions` 仅 limit 策略生效（默认 1）。仅 `create()`（登录/注册/SSO 登录）触发，refresh 轮换不触发。
- **端口接线 = 专用 `@Global` IdentitySecurityPortsModule**：新建只导出 `ACCESS_SESSION_VALIDATOR`/`SECURITY_EVENT_RECORDER` 两个 token 的小模块（import IdentityModule，useExisting 两个 adapter）；**IdentityModule 还原为非全局**，缩小全局面。两 app 根模块 import 该端口模块。
- **外部账号绑定 = 实现完整 SSO 回调绑定（intent=bind）**：新增受保护端点 `GET /sso/:provider/bind/authorize`（需登录），state 携带 `intent/bindSubjectType/bindUserId`；回调按 intent 分流，bind 分支用**验证过的** providerUserId 调 `ExternalIdentityService.link` 绑到当前登录用户，不登录/不开户。`external-accounts.link` 占位端点保留并在文档指向新路径。
- **登录锁定/风控阈值 = 配置化（默认不变）**：新增 `securityConfig`（env：`LOGIN_MAX_FAILED=5 / ACCOUNT_LOCK_MINUTES=15 / SUSPICIOUS_IP_WINDOW_SECONDS=3600 / SUSPICIOUS_IP_THRESHOLD=20 / IP_BAN_SECONDS=3600`），login.service 与 ip-blacklist.service 改为注入读取（带兜底常量）。
- **用户名枚举 = 维持统一 INVALID_CREDENTIALS**（无改动）。
- **Token 黑名单 TTL = 按 access 自然过期动态（逐 token 精确）**：移除固定 7 天。`BaseAuthUser` 增加 `exp` 字段，admin/user 两个 access 策略 `validate()` 把 `payload.exp` 透传进 `request.user`；logout/logoutAll 用 `resolveBlacklistTtlSeconds(user.exp)` 计算 TTL=该 token 剩余有效期（`max(exp-now,0)`），exp 缺失时回退到配置的 access 过期时长。已实现逐 token 精确 TTL。
- **SSO redirectUri = 生产强制 https**：在 provider 注册（onModuleInit）处集中校验，NODE_ENV=production 且 callbackUrl 非 https 则启动期 fail-fast；本地/开发仍允许 http。
- **SSO 自动注册 / 队列可靠性参数 = 维持现状**（默认开启 / 硬编码常量）。

迁移：本轮无新增 schema 列（审计列、会话列、锁定列均已并入单一 InitSchema）。

### 合并前人工验证（沙箱无法编译）
`pnpm typecheck && pnpm build`；启动验证：replace 策略下二次登录踢掉前一会话；`/sso/:provider/bind/authorize` 登录态发起→回调把外部账号绑到当前用户而不登录；生产环境非 https callbackUrl 启动即报错；登录失败 5 次锁定走 env 配置；logout 后黑名单 TTL≈access 过期时长。重点编译校验：SSO 回调判别联合在 user/admin 两处的窄化、securityConfig 与 IdentitySecurityPortsModule 的 DI 解析。

---

## ★★★★ 第四轮：迁移合并 + 剩余增强（2026-06-26）

- **移除 check:no-ai**：用户已删除 `scripts/check-no-ai.ts`；本轮清理全部残留引用——`tsconfig.json` exclude 项、`README.md`/`CONVENTIONS.md`/`.cursor/rules/architecture.mdc`/`tools/eslint-rules/README.md` 文档（"禁止 AI 内容"约定保留，改为代码评审强制）。
- **迁移合并**：把 6 个增量迁移（EndUserLock/TaskDedupKey/RoleEnabled/DictItemValueUnique/TaskDispatchLock/AdminUserLock）的列、索引、唯一约束全部折叠进 `1700000000000-InitSchema.ts` 的对应 CREATE TABLE，并删除这 6 个文件。现在 `database/migrations/` 仅剩单一 InitSchema。`data-source.ts` 以 glob 加载迁移，无需改引用。
  - 折叠明细：admin_users/end_users 加 `failed_login_count/locked_until/last_failed_login_at`；roles 加 `enabled`；tasks 加 `dedup_key`(+唯一索引)、`dispatched_at/locked_by/locked_at`(+两个复合索引)；dictionary_items 加 `(dict_id,value)` 唯一索引。
- **剩余增强（已实现）**：
  - **行级操作人审计自动回填**：新增 `AuditFieldsSubscriber`（TypeORM EntitySubscriber），insert/update 时从 `RequestContextService` 静态读取 sub/username，仅对声明了 created_by/updated_by(+username) 列的实体回填（task_logs 等无列表自动跳过），无上下文时保持 null。列早已存在，本次补齐"谁改的"行级审计。
  - **并发会话上限**：`SessionService.create` 后 `enforceMaxActiveSessions`，活跃会话超过 `jwt.maxActiveSessions`（env `JWT_MAX_ACTIVE_SESSIONS`，默认 5，≤0 不限）则按最旧驱逐（revokedReason='max_sessions_evicted' + 记 SESSION_REVOKED 事件）。
  - **缓存防穿透/防雪崩**：`getOrSet` 对 null 结果写短 TTL 哨兵占位防穿透（可关）；`set`/`getOrSet` 正数 TTL 默认 ±10% 抖动防雪崩；不破坏 withLock/getDel 语义，向后兼容旧 namespace 参数。
  - **限流 key 维度**：限流 key 拼入 `Controller.handler` 路由标识，使同一 IP/用户在不同端点独立计数（不再 A 打满连带封 B）；用 handler 名而非含参 URL 避免 key 爆炸。

### 仍未做（明确设计取舍/超模板范围）
设备实体与新设备风控、data-scope/多租户（P2）、retry 双计数语义统一（已注释说明）、DLQ 其它队列（按 QUEUE-SPEC opt-in）、审计结果体积阈值配置化。

### 合并前人工验证（沙箱无法编译）
`pnpm typecheck && pnpm build`；`migration:run` 应用单一 InitSchema 后表结构含上述全部列/索引；启动验证审计行 created_by/updated_by 被回填、并发登录超 5 个会话最旧被踢、限流分端点独立。重点编译校验：`AuditFieldsSubscriber` 的 `event.metadata.columns` 类型、`jwtConfig.maxActiveSessions` 的 feature 注册、cache options 重载类型。

---

## ★★★ 第三轮：完整文件复审 + 剩余缺口补齐（2026-06-26）

沙箱挂载仍不可刷新（bash 读 106 行文件只得 36 行），全程仅用 Read/Grep/Glob 文件工具（绕过挂载读完整文件）。本轮先**校验第二轮所有改动的正确性**，再补齐剩余缺口。

### 第二轮改动校验结论：全部通过
请求上下文中间件注册、IdentityModule `@Global` 双端口绑定、两 app 移除根级绑定、`IdentityAccessSessionValidator implements AccessSessionValidator`、禁用即时失效/外部账号绑定堵死/登录+SSO 审计/改密下限/SSO 锁定校验 —— 经完整读取核验：DI 可解析、无循环依赖（identity 仅 import @platform/auth 的 Symbol 常量，方向合规）、无 dangling import、错误码均已登记 HTTP 映射、请求上下文与端口接线真正闭环。额外确认：单端 logout 现也能即时失效在途 access token（经 revokedAt 检查）。

### 本轮补齐的剩余缺口（已实现）
- **队列可靠性兜底（高，原最大遗留漏洞）**：Task 实体加 `dispatchedAt/lockedBy/lockedAt`（迁移 `1700000005000`）；`TaskService` 加 `findPendingForDispatch / markDispatched / recoverStaleTasks`，`claim` 写租约，`createAndEnqueue` 投递后 `markDispatched`；worker 新增 `task-dispatch.schedule`（每 15s 扫 PENDING 兜底投递）与 `task-stale-recovery.schedule`（每 5min 恢复卡死 RUNNING→RETRYING/FAILED，错误码 `TASK_STALE_TIMEOUT`）；DLQ：`QUEUE_NAMES.DEAD_LETTER` + `QueueProducer.enqueueDeadLetter` + task-retry processor `@OnWorkerEvent('failed')` attempts 耗尽转投（基类不强改，按 opt-in，QUEUE-SPEC 增约定）。
- **批量授权事务（中）**：`role.service` 的 `assignPermissions/assignMenus/assignRolesToUser` 用 `dataSource.transaction` 包裹 delete+save。
- **注册唯一冲突映射（中/漏洞）**：end-user/admin-user `create` 捕获 MySQL 1062，按列映射 `USER_USERNAME_TAKEN/USER_EMAIL_TAKEN/USER_PHONE_TAKEN`（并发不再回退 500）。
- **管理员登录失败锁定（中）**：AdminUser 加 `failedLoginCount/lockedUntil/lastFailedLoginAt`（迁移 `1700000006000`）+ 服务方法；`login.service` 锁定闸门由"仅 user"放宽到 admin+user。
- **用户名枚举（低/信息泄露）**：主体不存在改抛统一 `INVALID_CREDENTIALS`。
- **SSO 自动注册开关 + 邮箱域白名单（中）**：`sso.config` 加 `allowAutoRegister`（默认 true）/`allowedEmailDomains`；callback `resolveUser` 开户前 gating（`SSO_AUTO_REGISTER_DISABLED`/`SSO_EMAIL_DOMAIN_NOT_ALLOWED`）。
- **DTO 密码下限统一（低）**：create-user/create-admin-user 由 6→8。
- **`scripts/check-no-ai.ts`（中/规范，CLAUDE.md 明确要求）**：新增扫描 `ai-fastapi|prompt|model-provider|embedding` 残留脚本 + `check:no-ai`（当前 libs/apps 无命中）。注：沿用 `ts-node`（项目未装 tsx）。
- **i18n 业务错误文案（中/合规）**：error.json（中英）补齐 identity/auth/RBAC_/SYS_CFG_/SYS_DICT_/TASK_/OP_LOG_/PERM_/SSO_ 各域已用错误码文案。

迁移序列（无冲突）：`...0000 InitSchema → 1000 EndUserLock → 2000 TaskDedupKey → 3000 RoleEnabled → 4000 DictItemValueUnique → 5000 TaskDispatchLock → 6000 AdminUserLock`。

### 仍属设计内/可后续（非漏洞）
- 行级 `createdBy/updatedBy` 审计字段（请求级 operation_logs 已覆盖；CLAUDE.md 未强制行级）。
- 并发会话上限/设备实体/新设备风控；缓存防穿透/雪崩；限流 key 加路由维度；审计/慢请求阈值配置化；retry 双计数语义统一；data-scope/多租户（P2）。
- DLQ 仅 task 队列接入，其它队列按 QUEUE-SPEC opt-in。

### 合并前必须人工验证（沙箱无法编译/启动）
`pnpm install && pnpm typecheck && pnpm build`；启动三个 app 实测：越权拒绝/SSO 登录各落一条带 requestId 的审计与安全事件；旧（登出/改密/禁用）access token 被拒；故意让 enqueue 失败确认 dispatcher 兜底重投、kill worker 确认 stale 任务被恢复。重点编译校验：`@nestjs/bullmq` 的 `OnWorkerEvent`、`login.service` 的 `subjectService()` 联合类型、各新增 config 的 feature 注册。

---

## ★★ 第二轮：完整文件复审（清除沙箱缓存后，2026-06-26）

第一轮的子审计因沙箱 FUSE 挂载读到**截断**源码（把 188 行读成 107 行）而产生假阴性/假阳性。本轮**全程仅用 Read/Grep/Glob 文件工具**（绕过损坏的挂载，读完整真实文件，已逐个验证文件读到结尾），复审"已实施修复的正确性 + 之前被截断隐藏的剩余缺口"。

### 本轮发现的「致命接线缺陷」——上一轮的修复挂在了空气上（已修复）

完整读取模块装配后，发现第一轮三项核心加固**实际从未生效**（截断让上一轮无法追踪完整的模块 wiring）：

1. **请求上下文从未激活**：`RequestContextModule` 被两个 app 导入，但它不 `configure` 中间件（`forRoutes('*')` 只存在于 JSDoc 示例里），且无 app 实现 `NestModule`。→ `getContext()` 恒为 `undefined`，连带操作日志的 requestId/ip/device/geo、操作人回填、日志 traceId 关联**全部失效**。
   - **已修复**：`RequestContextModule` 实现 `NestModule.configure()` 自动 `apply(RequestContextMiddleware).forRoutes('*')`（@Global，所有 app 自动生效）。
2. **`ACCESS_SESSION_VALIDATOR` 无法注入策略**：端口在 app 根模块 providers 绑定，但 passport 策略在 `AuthModule.forRoot()` 自身上下文实例化，**看不到根模块的局部 provider**，`@Optional` 注入静默落空 → 会话吊销/账号禁用/改密对在途 access token 的实时失效**全部死代码**。
   - **已修复**：把端口绑定移入 `@Global` 的 IdentityModule（provide+export），策略可全局解析；移除两个 app 根模块的冗余绑定。
3. **`SECURITY_EVENT_RECORDER` 从未绑定**：全仓库零绑定 → `ACCESS_DENIED` 永不落库。
   - **已修复**：新增 `SecurityEventRecorderAdapter`（委托 SecurityEventService），由 `@Global` IdentityModule 绑定导出。

### 本轮"已实施修复"的正确性核验结论
- ✅ 正确闭环：access strategy 三重校验+HS256、refresh 仅 Cookie、登录失败锁定、refresh 复用检测+family 撤销、SSO 全链路(state 原子消费/PKCE verifier 回调换 token/nonce 校验/emailVerified 门槛/redirectUri 防重定向)、缓存 token-CAS 锁/原子 getDel、限流单 Lua、删角色级联清理、SUPER_ADMIN 豁免、self/最后超管保护、菜单祖先补全、TypeORM 错误映射(确认 DB 为 MySQL，errno 1062 正确)。
- ⚠️ 修了但未生效（已在本轮补接线，见上）：请求上下文、两个端口。

### 本轮补修的剩余缺口（已修复）
- **禁用用户/管理员即时失效**：admin/end-user `update` 在 status 离开 ACTIVE 时 `revokeAllForUser('disabled')` + `incrementPasswordVersion` + 记 `ACCOUNT_DISABLED`（refresh 路径的 status 闸门经核验已存在于 auth.service，未重复改以免循环依赖）。
- **外部账号绑定账号接管**：user-api `external-accounts.link` 端点改为恒抛 `EXTERNAL_LINK_MUST_USE_OAUTH`，强制走 SSO 回调绑定（不再信任请求体 providerUserId）。
- **SSO/登录审计**：login 加 `@OperationLog`；SSO `@Res()` 回调成功后 `createWithContext({module:'OAuth',action:'SSO_LOGIN'})`（SSO 模块补 import AuditModule）。
- **SSO 绕过账号锁定**：user-sso 回调登录补 `lockedUntil` 校验。
- **改密 DTO 下限** 6→8；**字典项** 加 `@Unique(['dictId','value'])` + 迁移 `1700000004000`；**排序白名单** 在 task/audit query service 接入 `assertSortWhitelist`；**队列 dedup 创建竞态** save 包 try/catch 回查幂等；**BullMQ 连接** 补 `maxRetriesPerRequest:null` + retryStrategy。

### 仍建议后续处理（未改，风险/工作量较大或属设计取舍）
- 队列可靠性兜底：Dispatcher/Outbox 补投、stale RUNNING 任务恢复(`recoverStaleTasks`)、死信队列(DLQ)。
- 管理员登录无失败锁定（仅 EndUser 有）；admin 是否需同等锁定待定。
- RBAC/system 写操作未回填行级 `createdBy/updatedBy`（操作日志已有请求级审计）。
- 批量授权(assignPermissions/assignMenus/assignRolesToUser)非事务包裹。
- 并发会话上限/设备实体/新设备风控、SSO 第三方 token 落库加密、缓存防穿透/雪崩、限流 key 加路由维度、注册唯一冲突映射具体 `USER_*_TAKEN`。
- i18n 错误文案补全 RBAC_/SYS_/PERM_DENIED/OP_LOG_* 等。

### 合并前必须人工验证（沙箱无法编译/启动）
1. `pnpm install && pnpm typecheck && pnpm build`。
2. 启动三个 app，发一条**越权拒绝**与一条 **SSO 登录** 请求，确认 `operation_logs` 与安全事件表各落一条**带 requestId** 的记录（验证请求上下文 + 两个端口确实生效——这是本轮接线修复的关键验收点）。
3. 构造"已 logout-all / 改密 / 被禁用"的旧 access token，确认被拒（验证 ACCESS_SESSION_VALIDATOR 生效）。

---

## ★ 实施日志（第一轮已落地的修复，2026-06）

以下为本轮已在真实文件上核验并实施的加固。**因沙箱挂载不可靠，全部未经 `tsc`/构建编译校验，合并前必须人工 `pnpm install && pnpm typecheck && pnpm build` 并启动三个 app 验证。**

**审计 / 日志**
- 操作日志 `sanitizeParams/sanitizeResult` 接入 `DataMaskingUtil.redactSensitiveKeys` 脱敏；登录/SSO 分支回填操作人、token 占位、SSO 仅留 provider。
- 查询返回侧 `operation-log.mapper.toDetailVo` 二次脱敏。
- 新增 `geo-location.util`（geoip-lite 懒加载，未装则降级）打通 country/region/city。
- 新增 `bull-job-context.util`（`runWithBullJobContext`），`BaseQueueProcessor` 包裹执行，producer 入队注入 traceId/requestId → worker 链路贯穿。
- 新增 `UserContextInterceptor`（两 app bootstrap 注册）+ `OperationLogService.createWithContext` 手动审计入口。
- 慢请求(>1000ms)打 warn+slow；安全事件枚举补 DEVICE_*/ACCESS_DENIED/EXTERNAL_IDENTITY_*；权限 guard 拒绝处经端口记 ACCESS_DENIED。

**认证 Auth**
- admin/user access strategy `validate()` 改 async：校验 typ+字段、`isBlacklisted(jti)`、可选端口 `ACCESS_SESSION_VALIDATOR`（会话有效/用户 ACTIVE/pv 匹配）；锁定 `algorithms:['HS256']`。
- refresh strategy 默认仅 Cookie 提取（`JWT_REFRESH_FROM_AUTH_HEADER` 开关），补 typ 校验。
- jwt.config 去掉 secret 空串兜底；token.service 锁定 HS256。
- 端口实现 `IdentityAccessSessionValidator`，在 admin-api/user-api 根模块绑定（**@Optional 注入：若解析失败 app 仍启动但该校验静默失效——务必启动时确认其生效**）。

**Identity**
- 密码策略接入注册/改密；register DTO 下限 8。
- 登录失败计数+锁定（EndUser 加 `failedLoginCount/lockedUntil/lastFailedLoginAt`，迁移 `1700000001000`，错误码 `USER_LOCKED`）。
- 登录接 IP 黑名单 `isBlocked` + 可疑活动累计自动封禁。
- 外部账号 `unlink` 校验剩余登录方式（`CANNOT_UNLINK_LAST_LOGIN_METHOD`）；`link` 标注必须走 OAuth 回调；link/unlink 记 `EXTERNAL_IDENTITY_LINKED/UNLINKED`。
- `logoutAll` 递增 pv 使在途 access token 即时失效；lastLoginIp 落库统一 `maskIp`。

**access-control / system**
- 删角色事务内级联清理 user_roles/role_permissions/role_menus + 失效缓存；Role 加 `enabled`（迁移 `1700000003000`），权限聚合 JOIN 过滤软删/停用角色。
- `access-check.hasPermissions` SUPER_ADMIN 运行时豁免；管理员 self 危险操作防护 + 最后一个超管保护；assignRoles 校验角色存在。
- 菜单树补全祖先节点；补 PermissionService.remove + 菜单子树处理（`RBAC_MENU_HAS_CHILDREN`）。
- 系统配置写时类型校验 + 改 softRemove；字典项 (dictId,value) 唯一（`SYS_DICT_ITEM_VALUE_TAKEN`）。

**基础设施**
- SSO：`NormalizedProfile.emailVerified` + 邮箱自动绑定强制已验证；nonce/PKCE codeVerifier 绑定 state；redirectUri 不信客户端、强制服务端配置；state 原子 `getAndDel`。
- 缓存：`acquireLock/releaseLock/withLock`（token-CAS Lua）；`getDel` Lua 原子；补 `setNX` 等。
- 限流：单条 Lua 完成 INCR+EXPIRE+TTL（消除 key 永不过期竞态）。
- 分页：`sortBy/order(@IsIn)` + `assertSortWhitelist`，pageSize 上限 100。
- 异常过滤器：TypeORM 错误映射（唯一约束→409 / EntityNotFound→404 / 其余→500 `SYS_DB_ERROR`，driverError 仅入日志）+ i18n 文案。
- 队列：task 加 `dedupKey`（唯一索引，迁移 `1700000002000`）+ 入队 `jobId=task.uid` + attempts/backoff；`claim()` CAS 认领防双 worker 重复执行。

**迁移文件（执行顺序）**：`1700000000000-InitSchema` → `1700000001000-AddEndUserLockFields` → `1700000002000-AddTaskDedupKey` → `1700000003000-AddRoleEnabledField`（已修复两个 agent 的 `1700000002000` 时间戳冲突）。

**合并前必须人工确认（无法沙箱编译）**：
1. `ACCESS_SESSION_VALIDATOR` 在 strategy 中能否真正解析（根模块 provider 对 AuthModule 内 strategy 的可见性）——这是安全校验是否真正生效的关键。
2. geoip-lite 需 `pnpm install`；确认构建器不禁用 `eval('require')`。
3. 各新增错误码的 i18n 文案（RBAC_/SYS_/identity 域）按需补全。
4. TypeORM QueryBuilder 原生列名/raw set 表达式、ioredis `eval` 重载的类型收窄。
5. 第 8 项 ACCESS_DENIED 落库需在 app 层绑定 `SECURITY_EVENT_RECORDER` adapter（目前未绑定则不记录）。

---

## 1. 认证 Auth（libs/platform/auth）

模板方向优于 cs：集中式 `TokenService` + admin/user/refresh 三套独立 strategy/guard + `TokenBlacklistService`。
但存在实质安全缺口：

| 级别 | 安全漏洞 | 问题 | 修复方向 |
|---|---|---|---|
| 高 | 是 | **黑名单只写不读**：`TokenBlacklistService.blacklist()` 在 logout 写入，但全仓库无任何 `isBlacklisted()` 调用方 → 登出/踢下线后 access token 在有效期内仍可用 | 在 access guard/strategy 校验链接入 `isBlacklisted(jti)` |
| 高 | 是 | **access strategy 不校验会话/用户状态/pv**：`admin-jwt.strategy`/`user-jwt.strategy` 的 `validate()` 只映射 payload，不查会话是否撤销、用户是否被禁用、`passwordVersion` 是否匹配 → 改密/禁用无法使旧 token 失效 | 注入可插拔 `SessionValidator` 端口，补三重校验（对齐 cs `apps/*/auth/strategies/jwt.strategy.ts`） |
| 高 | 是 | **JWT 密钥可为空、未锁定算法/iss/aud**：`jwt.config.ts` 用 `|| ''` 兜底，validation schema 无 `required().min(32)`；签名/校验未传 `algorithms:['HS256']` | 加 Joi 强校验、去掉空串兜底、锁定算法、补 issuer/audience |
| 中 | 是 | **refresh token 可从 Authorization 头取**：`refresh-jwt.strategy` 优先读 Bearer 再回退 Cookie，削弱 HttpOnly Cookie 防护 | 默认仅 Cookie 提取，移动端 Bearer 走开关 |
| 中 | 是 | **复用检测家族撤销未实现**（`session.service` 截断）：旧 RT 命中已轮换会话不会撤销整条 family | 补 `validateRefreshSession`/`rotateSession`：检测 `rotated` → 撤 family + 记 critical 事件 |
| 中 | 是 | **strategy 无 `typ` 校验**：admin/user access 共用同一 `accessSecret`，缺 `typ` 强约束 → 双体系隔离仅靠 strategy 名称，user token 结构上可被 admin strategy 接受 | 各 strategy 校验 `payload.typ` 与字段类型 |
| 中 | 否 | 基础设施异常被吞成 401（DB 抖动→误登出） | 区分 401/403 与 503 |

---

## 2. 用户身份 Identity（libs/domains/identity）

模板优于 cs 的部分（保留）：refresh 轮换+盗用检测组织更清晰、refresh 增加 pv 闸门、改密强制下线+pv 递增完整、access token 黑名单是 cs 没有的。

**核心提醒：`PasswordPolicyService`、`IpBlacklistService`、`DeviceInfoService` 已实现但未接入注册/登录主流程——"有轮子没装上"。**

| 级别 | 安全漏洞 | 问题 | 修复方向 |
|---|---|---|---|
| 高 | 是 | **无登录失败计数/账号锁定**：`EndUser` 缺 `failedLoginCount/lockedUntil/lastFailedLoginAt`，密码错误只记事件不累计、不锁定 → 可暴力破解 | 加字段 + `incrementFailedLogin/resetFailedLogin/lockUser`，登录前查锁定 |
| 高 | 是 | **登录链路未接 IP 黑名单/可疑活动自动封禁**：`LoginService` 从不调用 `isBlocked`，无累计→自动拉黑 | login 开头查 `isBlocked(ip)`，补 `recordSuspiciousActivity`（窗口+阈值+自动封禁，对齐 cs） |
| 高 | 是(弱口令) | **密码策略未接线**：注册/改密直接落库，从不调 `PasswordPolicyService.validate()`，DTO 仅 `@Length(6,128)` | 注册/改密前 `validate()`，下限提到 8 |
| 高 | 部分 | **注册唯一性"先查后插"无并发兜底**：并发同邮箱双插，DB 唯一冲突抛原始 500 而非 409 | try/catch 捕获唯一约束 → 映射 `USER_*_TAKEN`（对齐 cs `rethrowAsConflict`） |
| 高 | 否 | **注册不分配初始角色**：新用户无任何角色基线，接入 RBAC 后全 403 | 注册成功绑定默认角色（code 走 seed/system-config） |
| 高 | 部分 | **无设备实体/设备落库**：identity 无 device 表，`DeviceInfoService` 未在建会话时调用 → 无"登录设备列表/移除设备/可信设备/新设备风控" | 新增 `EndUserDevice` + `DeviceService` + `establishSession` 接入 + user-api `devices.controller` |
| 高 | 是 | **外部账号绑定无所有权验证**：`link()` 直接信任 body 里的 `providerUserId`，可抢绑他人账号 | 绑定必须走真实 OAuth 回调，DTO 不含 `providerUserId` |
| 高 | 是 | **解绑不校验"最后登录方式"**：纯 SSO 用户解绑最后身份后永久无法登录 | unlink 前校验剩余登录方式，否则抛 `CANNOT_UNLINK_LAST_LOGIN_METHOD` |
| 中 | 是(隐私) | **IP 落库未脱敏**：会话/`lastLoginIp` 存完整 IP，安全事件却已 `maskIp`，标准不一 | 统一走 `maskIp()` |
| 中 | 是 | **logoutAll 不失效其他端 access token**：只拉黑当前 jti | logoutAll/强制下线/设备撤销时 `incrementPasswordVersion` |
| 中 | 否 | 无并发会话上限/同设备替换（cs 有 replace/limit + maxActiveSessions=5） | `SessionService.create` 增加并发策略 |
| 中 | 否 | 绑定/解绑未记安全事件 | link→`EXTERNAL_IDENTITY_LINKED`，unlink→`...UNLINKED` |
| 中 | 部分 | admin 改 email/phone 不查唯一性 | 校验+捕获冲突，换绑走验证码 |
| 低 | 否 | 注册返回会话 `passwordVersion` 硬编码 0；昵称在 EndUser/Profile 双写不同步；`unionId` 无索引 | 取真实 pv；定单一数据源；按需加索引 |

---

## 3. 权限控制 access-control + 系统管理 system

| 级别 | 安全漏洞 | 问题 | 修复方向 |
|---|---|---|---|
| 高 | 是(越权) | **删除角色不清理关联**：`role.service.remove()` 只 softRemove Role，不清 `user_roles/role_permissions/role_menus`（显式 join 实体无 CASCADE）→ 软删角色权限仍被聚合 | 事务内级联 delete 三张关联表 + 失效缓存；或 join 实体加 `onDelete:CASCADE` |
| 高 | 是(越权) | **权限聚合不过滤失效角色**：`getRoleUidsForUser` 不校验角色存活/启用；`Role` 甚至无 `enabled` 字段 | 聚合时 JOIN 过滤 `deletedAt IS NULL AND enabled=true`，补 `enabled` 字段 |
| 高 | 治理风险 | **无 SUPER_ADMIN 运行时豁免**：seed 只快照当时权限，新增权限点后超管自动 403 | `AccessCheckService.hasPermissions` 对超管角色短路返回 true |
| 高 | 是 | **管理员无"自我危险操作"防护**：`administrators` 的 update/assignRoles/resetPassword 无 self 校验，可自我降权锁死（已有 `OPERATION_NOT_ALLOWED` 错误码未用） | 注入操作者，禁止对自身 disable/delete/reset/清空角色 |
| 高 | 是 | **无"最后一个超管"保护**：可把唯一超管降权 → 无人可管理 | 变更前统计启用超管数，将降为 0 则拒绝 |
| 中 | 悬挂引用 | 缺删除权限点能力；删菜单不处理子树/`role_menus` | 补 `PermissionService.remove` + 菜单级联/拒删 |
| 中 | 否 | **用户菜单树丢失祖先节点**：`menusForUser` 只查被直接授权节点，未授权父目录则叶子被当顶级 | 解析后向上补全祖先 |
| 中 | 可能 | 管理员缺 disable/enable/delete；禁用是否即时生效存疑 | 补端点，disable 时吊销会话，guard 每请求校验状态 |
| 中 | 数据质量 | 系统配置写时不校验类型（存 `NUMBER="abc"` 成功，读时才炸）；`delete` 硬删；upsert 无并发兜底 | `set()` 按 type 校验；改 softRemove；key 唯一约束+捕获冲突 |
| 中 | 数据质量 | 字典项无 `(dictId,value)` 唯一校验 | addItem/updateItem 校验 + 复合唯一索引 |
| 低 | 否 | assignRoles 不校验角色存在；access-control 写操作无 operator 审计字段；字典缓存 key 无前缀 | 逐项补齐 |
| 中 | 否 | 无 data-scope/多租户（CLAUDE.md 已列 P2，属设计内）→ 文档注明 | references 说明扩展方式 |

---

## 4. 审计 Audit + 日志 Logger + 请求上下文（用户重点）

底座已相当成熟（操作日志入队落库、SecurityEvent 带 subjectType、Pino 结构化日志、统一异常信封），但**审计/日志的"完整性"有明确缺口**：

| 级别 | 影响 | 问题 | 修复方向 |
|---|---|---|---|
| 高 | 合规+安全 | **请求参数/响应未脱敏入库**：`operation-log.interceptor.sanitizeParams()` 只做深拷贝，明文 password/token/code 原样落 `operation_logs.params`（`DataMaskingUtil.redactSensitiveKeys` 已存在未接线） | sanitizeParams 接 `redactSensitiveKeys`；worker 落库前兜底 |
| 高 | 合规+安全 | **查询返回侧未脱敏**：缺 `SensitiveDataRedactor`，后台查询是二次泄露面 | 移植/封装 redactor，detail VO 转换处脱敏 |
| 高 | 功能 | **地理位置永远为空**：实体有 country/region/city、拦截器会读 `getGeoLocation()`，但中间件从不填充（无 geoip） | 中间件补 `geoip-lite` 解析写入上下文 |
| 高 | 链路完整性 | **Worker 侧不重建请求上下文**：无 `runWithBullJobContext`，`BaseQueueProcessor` 未用 `RequestContextService.run` 包裹，producer 不注入 traceId → worker 日志（含审计落库）丢 traceId/requestId/jobUid | 新增 `bullJobToRequestContext`/`runWithBullJobContext`，processor 包裹，producer 自动注入 |
| 高 | 审计准确性 | **无 UserContextInterceptor**：`setUser` 有定义无调用方 → SSO `@Res()` 回调/Service 层日志拿不到操作人；缺 `createWithContext` 手动审计入口 | 新增 UserContextInterceptor + `OperationLogService.createWithContext` + manual command |
| 中 | 安全 | 登录/SSO 操作人未回填、token/code 未特殊处理（叠加未脱敏更严重） | 拦截器补登录/SSO 分支：回填 sub/username、token 占位、SSO 参数只留 provider |
| 中 | 合规 | 写操作强制审计无静态约束（靠手标，易漏） | check 脚本/eslint 规则校验非 GET 路由是否带审计装饰器 |
| 中 | 可观测性 | 无慢请求标记 | 超阈值请求打 warn + `slow:true` |
| 中 | 安全 | 安全事件缺设备类/越权拒绝事件；需核验各落点已实际调用 | 补 `DEVICE_*`、权限 guard 拒绝时记 `ACCESS_DENIED` |
| 低 | — | 两份重复请求日志拦截器；i18n translate 同步调用可靠性 | 合并取舍；确认 translate |

---

## 5. 基础设施：security / common / cache / queue / sso

模板优点（保留）：限流多维 `keyBy`、IP 取自 RequestContext 防伪造、缓存分层、core 不绑业务码、OIDC 通用 JWKS 验签（拒绝 alg=none）、PKCE 通用化、SSO subjectType 感知。

| 级别 | 安全漏洞 | 问题 | 修复方向 |
|---|---|---|---|
| 高 | 是 | **缓存缺分布式锁**：无 `withLock`，缓存击穿/并发重复执行无防护 | 移植 `withLock`（释放用 token-CAS Lua 防误删他人锁） |
| 高 | 是(SSO) | **nonce/PKCE code_verifier 未绑定 state**：`SsoStatePayload` 只存 redirectUri，回调取不回 verifier/nonce → PKCE/nonce 实际不生效 | state 写入 nonce/codeVerifier，回调取回校验 |
| 高 | 是(SSO) | **redirectUri 接受客户端传入**：open-redirect/令牌泄漏风险 | 强制用 provider 配置的固定 callbackUrl，生产 HTTPS，不信前端传入 |
| 高 | 是(SSO) | **按邮箱自动绑定无 emailVerified 门槛**：`NormalizedProfile` 无 `emailVerified` → 账号接管 | 加字段，email 绑定分支强制 `===true` |
| 中 | 是(SSO) | **state 消费非原子**（get 后 del），可复用 | 改原子 `getAndDel`（Lua） |
| 中 | 是 | **限流计数器非原子**：incr 后单独 expire，竞态下 key 可能永不过期（永久封锁）或漏设 TTL | 单条 Lua 完成 INCR+首次EXPIRE+读TTL |
| 中 | 是 | **缓存 getDel 在旧 Redis 非原子**：一次性令牌/SSO 码重放窗口 | Lua 原子 GET+DEL |
| 中 | 是 | **分页无排序白名单、pageSize 上限 1000**：SQL 注入面 + DoS（CLAUDE.md 要求白名单未实现） | 加 `sortBy`+`@IsIn order`+`assertSortWhitelist`，上限收紧至 ~100 |
| 中 | 部分 | **队列幂等三件套缺失**：task 无 `dedupKey`、入队不设 `jobId`、processor 无 CAS 认领 → 重复/并发执行 | 加 dedupKey 唯一索引、`jobId: task.uid`、`tryClaim`(事务+悲观锁+CAS) |
| 中 | 部分 | **无 Dispatcher/Outbox 兜底 + stale 恢复**：入队失败/崩溃任务永久滞留；audit/user/sso 事件不落库，Redis 丢=审计永久丢 | task 加 `lockedBy/lockedAt/dispatchedAt`，cron 扫 PENDING 兜底投递 + `recoverStaleTasks`；评估事件落 outbox |
| 中 | 是 | 全局过滤器无 TypeORM 错误映射（23505→409 等被吞成 500，泄漏面） | filter 加 TypeORM 分支 |
| 中 | 否 | 可疑活动累积自动封禁缺失（cs `recordSuspiciousActivity`） | 移植自动封禁 |
| 高 | 否 | i18n 错误文案严重不足（缺 `SYS_DB_ERROR`，各业务域无 error.json） | 补文案 + 业务 lib 自带 i18n 片段约定 |
| 中 | 否 | SSO token 落库未加密；无 allowAutoRegister 开关/域名白名单 | AES-256-GCM 加密 + 注册开关 |

---

## 6. 建议执行顺序

**P0（阻断，先做）**
1. 恢复 112 个截断文件的完整内容（git 历史/备份/参照 cs 重建）。
2. 加截断/NUL 完整性 CI 校验。
3. 恢复后跑通 `pnpm tsc --noEmit` + 三个 app 启动。

**P1（确凿安全漏洞，恢复后立即补）**
- Auth：黑名单接入校验链、access strategy 三重校验、JWT 密钥强校验+锁算法。
- Identity：登录失败锁定、IP 黑名单接线、密码策略接线、注册唯一性兜底、外部账号绑定走 OAuth + 解绑校验最后登录方式。
- access-control：删角色级联清理、聚合过滤失效角色、管理员 self/最后超管保护、SUPER_ADMIN 运行时豁免。
- 审计：参数/返回脱敏接线、worker 上下文重建、UserContextInterceptor 回填操作人。
- 基础设施：SSO 的 emailVerified/nonce+PKCE 绑定/redirectUri 防 open-redirect/state 原子消费、分页排序白名单、限流与缓存原子化、分布式锁。

**P2（可靠性，强烈建议）**
- 队列幂等三件套 + Dispatcher/Outbox 兜底 + stale 恢复；设备实体/管理；TypeORM 错误映射；可疑活动自动封禁；地理位置采集。

**P3（健壮性/规范沉淀）**
- i18n 文案补全；慢请求日志；缓存防穿透/雪崩；合并重复拦截器；把上述安全不变量写入
  `references/AUTH-SPEC.md`/`SSO-SPEC.md`/`AUDIT-SPEC.md`/`QUEUE-SPEC.md` 作为强制条款，
  并用 `scripts/check-*.ts` 落地校验，防止后续 AI/人工绕过。

---

## 7. 模板优于 cs、应保留的设计

- admin/user/worker 三体系彻底分离，admin 绝不自动开户。
- OIDC id_token JWKS 通用验签（拒绝 alg=none/HS*）、PKCE 通用化（cs 仅 Krafton 有）。
- 缓存分层（RedisService 原语 + CacheService 语义）、结构化 buildKey、优雅断连。
- 限流多维 keyBy（ip/user/ip-path）、IP 取自 RequestContext 防伪造。
- core 不绑业务错误码、业务 lib 自注册 → 天然满足"禁止 AI 残留"不变量。
- refresh 轮换+盗用检测+family 撤销组织清晰，refresh 增加 pv 闸门，改密强制下线 + access 黑名单。
- 操作日志异步入队落库（优于 cs 同步 create().catch()）、SecurityEvent 带 subjectType 同时覆盖后台与用户端。
