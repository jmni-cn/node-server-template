# ENV-SPEC — 环境变量规范

本文档梳理 `node-server-template` 真实使用到的所有环境变量，说明每个变量「由谁读取、在什么阶段读取」，并明确区分 **docker 编排/构建期变量** 与 **容器启动后由应用读取的运行期变量**。

变量清单以代码为准，来源：

- `libs/core/config/src/namespaces/*`（`registerAs` 命名空间 + Joi 校验 Schema）
- `libs/core/database/src/typeorm-options.factory.ts`（migration / 数据源直接读 `process.env`）
- `libs/core/common/src/utils/crypto.util.ts`（凭证加密盐）
- 各 app 的 `main.ts` / `bootstrap/*`（端口、前缀、Swagger 等直接读 `process.env` 的变量）

---

## 一、两套加载机制（先理解这个，其余都好懂）

应用本身只有一个配置入口：`AppConfigModule`（`libs/core/config/src/config.module.ts`）。它的行为由 `NODE_ENV` 决定：

| NODE_ENV | 是否读 env 文件 | 读哪个文件 | 变量来源 |
|---|---|---|---|
| `development` | 是 | `env/<APP_NAME>.local.env` | 文件 + 进程环境变量 |
| `test` | 否（用进程环境变量） | — | 进程环境变量 |
| `production` | 否（`ignoreEnvFile=true`） | — | **纯进程环境变量** |

关键结论：

- **本地开发**：`npm run start:dev:admin` 经 `cross-env` 注入 `NODE_ENV=development APP_NAME=admin-api`，于是应用读 `env/admin-api.local.env` 这**一个自包含文件**。所以每个 `.local.env` 必须写全本 app 需要的变量。
- **生产**：`NODE_ENV=production` 时应用**不读任何文件**，全部依赖容器进程里的环境变量。这些变量由 `docker-compose.prod.yml` 经 `env_file: ../env/<app>.env` 注入到容器，或由 k8s ConfigMap/Secret 注入。

> 因此生产用的 `env/<app>.env` 文件本质是给 **docker** 注入的，不是给 Node 应用直接 `dotenv` 读的。

---

## 二、三套环境与文件布局

所有环境变量文件统一放在 `env/` 目录，按**后缀**区分三套环境，每套按 app 拆分：

| 后缀 | 环境 | 谁消费 | host 指向 | 入库 |
|---|---|---|---|---|
| `env/<app>.local.env` | 本地开发（非容器） | Node 应用（`npm run start:dev:*` 的 dotenv） | `127.0.0.1` | 否（仅 `.example`） |
| `env/<app>.dev.env` | docker dev 栈 | `docker-compose.dev.yml` 的 `env_file` | compose 服务名 `mysql`/`redis` | 否（仅 `.example`） |
| `env/<app>.env` | 生产 | `docker-compose.prod.yml` 的 `env_file` | 外部托管地址 | 否（仅 `.example`） |

`<app>` ∈ `admin-api` / `user-api` / `worker`。真实文件全部被 `.gitignore`，仓库只提交对应的 `*.example` 模板，使用前拷贝去掉 `.example` 后缀并填值。

```bash
# 本地开发（连本机映射的 docker 基础设施）
cp env/admin-api.local.env.example env/admin-api.local.env   # 已带可直接用的默认值
npm run start:dev:admin

# docker dev 栈（容器化跑三个 app）
cp env/admin-api.dev.env.example env/admin-api.dev.env
docker compose -f docker/docker-compose.dev.yml --profile apps up

# 生产
cp env/admin-api.env.example env/admin-api.env             # 填真实密钥
docker compose -f docker/docker-compose.prod.yml up -d
```

> 为什么 `.local.env` 与 `.dev.env` 几乎一样还要分开？区别只在 `DB_HOST`/`REDIS_HOST`：本地连 `127.0.0.1`，docker dev 连 compose 服务名。分文件后 dev compose 不再需要 `environment:` 覆盖 host，语义更清晰。

---

## 三、变量全清单（按命名空间）

「读取者」列说明该变量由哪段代码消费；「必填」指 Joi 校验是否 `required()`。

### app（`app.config.ts`） + 各 app 启动期

| 变量 | 读取者 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `NODE_ENV` | 全局 / config.module | 否 | `production` | 决定加载机制，见上 |
| `APP_NAME` | logger（service 名）/ dev 文件选择 | 否 | `app` | 本地由 npm 脚本注入；docker 由镜像 ENV 固化，per-app 文件中显式写出也安全 |
| `APP_PORT` | `appConfig.port` / `app.baseUrl` 默认 | 否 | `3000` | ⚠️ 见「四、注意点」——实际监听端口用的是 `*_API_PORT` |
| `APP_BASE_URL` | `appConfig.baseUrl` | 否 | `http://localhost:${APP_PORT}` | 回调/绝对链接拼接 |
| `API_PREFIX` | `appConfig.apiPrefix` | 否 | `v1` | ⚠️ 实际前缀用的是 `*_API_PREFIX` |
| `CORS_ENABLED` | `main.ts` | 否 | `true` | 关闭 CORS 设为 `false` |
| `CORS_ORIGIN` | `main.ts` / `appConfig` | 否 | `http://localhost:3000` | 逗号分隔，禁止 `*`（与 credentials 冲突） |

### admin-api 专用（`main.ts` / `bootstrap`，直接 `config.get`）

| 变量 | 读取者 | 默认 | 说明 |
|---|---|---|---|
| `ADMIN_API_PORT` | `admin-api/main.ts` | `3001` | **真实监听端口** |
| `ADMIN_API_PREFIX` | `setup-app.ts` | `admin` | 全局路由前缀 |
| `ADMIN_SWAGGER_ENABLED` | `setup-swagger.ts` | `false` | 生产建议关 |
| `ADMIN_SWAGGER_PATH` | `setup-swagger.ts` | `docs` | 实际路径 `<prefix>/<path>` |

### user-api 专用

| 变量 | 读取者 | 默认 | 说明 |
|---|---|---|---|
| `USER_API_PORT` | `user-api/main.ts` | `3002` | **真实监听端口** |
| `USER_API_PREFIX` | `setup-app.ts` | `''` | 默认无前缀 |
| `USER_SWAGGER_ENABLED` | `setup-swagger.ts` | `false` | |
| `USER_SWAGGER_PATH` | `setup-swagger.ts` | `docs` | |

### worker 专用（`setup-worker.ts` / `app.module.ts`，直接 `process.env`）

| 变量 | 读取者 | 默认 | 说明 |
|---|---|---|---|
| `WORKER_CONCURRENCY` | `setup-worker.ts` | `5` | 日志展示用；BullMQ 并发实际取 `QUEUE_CONCURRENCY` |
| `WORKER_ENABLE_SCHEDULE` | `app.module.ts` | `true` | 关闭后不注册 cron |
| `WORKER_HEALTH_PORT` | （预留，未消费） | `3003` | 代码尚未实现独立健康探针，保留占位 |

### database（`database.config.ts` + `typeorm-options.factory.ts`）

| 变量 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `DB_HOST` | 否 | `mysql` | 本地 `127.0.0.1`；docker 内 `mysql`；生产填托管地址 |
| `DB_PORT` | 否 | `3306` | |
| `DB_USERNAME` | 否 | `root` | |
| `DB_PASSWORD` | 否 | `''` | |
| `DB_DATABASE` | 否 | `app` | 模板用 `app_template` |
| `DB_CONNECTION_LIMIT` | 否 | `20` | 连接池上限 |
| `DB_LOGGING` | 否 | `false` | `typeorm-options.factory` 读 `=== 'true'` |
| `DB_CHARSET` / `DB_COLLATION` / `DB_TIMEZONE` | 否 | utf8mb4 / utf8mb4_0900_ai_ci / +00:00 | 一般不改 |

### redis（`redis.config.ts`） + queue（`queue.config.ts`）

| 变量 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `REDIS_HOST` | 否 | `redis` | 本地 `127.0.0.1`；docker 内 `redis` |
| `REDIS_PORT` | 否 | `6379` | |
| `REDIS_PASSWORD` | 否 | `''`（空→undefined） | |
| `REDIS_DB` | 否 | `0` | |
| `QUEUE_CONCURRENCY` | 否 | `5` | BullMQ worker 真实并发 |
| `QUEUE_REDIS_HOST/PORT/PASSWORD/DB` | 否 | 回退 `REDIS_*` | 队列与缓存隔离时使用 |

### jwt（`jwt.config.ts`）

| 变量 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `JWT_ACCESS_SECRET` | **是（≥32）** | — | access token 密钥，所有 app（含 worker）启动校验都要求存在 |
| `JWT_REFRESH_SECRET` | **是（≥32）** | — | refresh token 密钥 |
| `JWT_ACCESS_EXPIRES_IN` | 否 | `15m` | |
| `JWT_REFRESH_EXPIRES_IN` | 否 | `7d` | |
| `JWT_REMEMBER_ACCESS_EXPIRES_IN` | 否 | 回退 access / `30m` | |
| `JWT_REMEMBER_REFRESH_EXPIRES_IN` | 否 | `30d` | |
| `JWT_COOKIE_SECURE` | 否 | `false` | 生产 https 必须 `true` |
| `JWT_COOKIE_SAME_SITE` | 否 | `lax` | |
| `JWT_COOKIE_DOMAIN` | 否 | — | 跨子域时设置 |

### sso（`sso.config.ts`，全部可选）

`SSO_ISSUER / SSO_CLIENT_ID / SSO_CLIENT_SECRET / SSO_REDIRECT_URI / SSO_SCOPE`、`SSO_MICROSOFT_*`、`SSO_KRAFTON_*`、`SSO_POST_LOGIN_REDIRECT`、`SSO_LOGIN_CODE_TTL`。未配置不影响启动；对应 `*_CLIENT_ID` 非空时才注册该 provider。主要在 user-api 使用。

### logger（`logger.config.ts`）

`LOG_LEVEL`（默认 `info`）、`LOG_PRETTY_PRINT`、`LOG_FILE_ENABLED`、`LOG_DIR`、`LOG_APP_FILE`、`LOG_ERROR_FILE`、`LOG_CUSTOM_FIELDS`(JSON)、`SERVICE_NAME`（缺省回退 `APP_NAME`）。

### 其它（直接 `process.env`）

| 变量 | 读取者 | 必填 | 说明 |
|---|---|---|---|
| `CREDENTIAL_ENCRYPTION_SALT` | `crypto.util.ts` | 否（有内置默认） | 外部账号 token 加密盐，**生产务必设置随机值** |

---

## 四、谁在 docker 用 / 谁在容器启动后用（核心区分）

把变量按「生命周期阶段」分三类：

### 1) docker-compose 编排期变量（在宿主机 shell / compose 解析时使用，**不进 Node 应用**）

这些是 compose 文件里 `${...}` 占位或喂给**基础设施镜像**的变量：

- **compose 变量替换**：`IMAGE_REGISTRY`、`IMAGE_TAG`（prod 拉取镜像名）、`DB_ROOT_PASSWORD`、`DB_DATABASE`、`DB_USERNAME`、`DB_PASSWORD`（dev compose 里 `${...}` 用于配置 mysql 服务）。
- **MySQL 镜像消费**：`MYSQL_ROOT_PASSWORD`、`MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD` —— 这些是 **mysql 官方镜像**的初始化变量，由数据库容器使用，**应用本身不读**。

> 这类变量从 compose 文件或宿主机 `.env`（compose 默认读取的同级 `.env`）取值，作用在「起容器」这一刻。

### 2) Dockerfile 构建/镜像期变量（烤进镜像，容器默认带上）

每个 Dockerfile 用 `ENV` 固化了：

- `NODE_ENV=production`
- `APP_NAME=admin-api`（user-api / worker 镜像各自不同）
- `ADMIN_API_PORT=3001`（对应镜像各自的端口）

> 生产环境变量已按 app 拆分为 `env/<app>.env`，每个文件只服务一个容器，因此可放心在各自文件里显式写 `APP_NAME`（与镜像 ENV 同值）。端口同理已由镜像带默认值，文件里写是为了显式可调。
>
> （历史提示：若改回「三个服务共用一个 env 文件」的写法，则**不要**在该共享文件里写 `APP_NAME`，否则会把三个容器覆盖成同一个值、污染日志 service 名。）

### 3) 容器启动后、Node 应用运行期读取的变量（真正的「应用配置」）

容器跑起来后，`AppConfigModule` / `main.ts` 从 `process.env` 读取的，就是第三章列出的全部业务变量：

`DB_*`、`REDIS_*`、`QUEUE_*`、`JWT_*`、`SSO_*`、`LOG_*`、`CORS_*`、`*_API_PORT`、`*_API_PREFIX`、`*_SWAGGER_*`、`WORKER_*`、`CREDENTIAL_ENCRYPTION_SALT`。

它们的注入路径：

| 部署方式 | 注入来源 | 对应文件 |
|---|---|---|
| 本地开发（非容器） | dotenv 读文件 | `env/<app>.local.env` |
| docker compose dev | `env_file`（host 已内置容器服务名） | `env/<app>.dev.env` |
| docker compose prod | `env_file: ../env/<app>.env` | `env/<app>.env` |
| kubernetes | `envFrom: configMapRef + secretRef` | `configmap.yaml` + `secret.yaml` |
| pm2 / systemd | 进程 env / `ecosystem.config.js` | 宿主机环境 |

一句话总结：**第 1 类喂给数据库/编排、第 2 类烤进镜像、第 3 类才是应用真正读取的运行期配置**。本次新建的 `env/*.local.env`、`env/*.dev.env`、`env/*.env` 都属于「第 3 类的注入源」，只是分别对应本地 / docker dev / 生产三套。

---

## 五、注意点 / 已修复的不一致

梳理过程中发现并处理的偏差：

1. **`JWT_SECRET` 拼写错误（已修复）**：`docker-compose.test.yml` 与 `deploy/k8s/secret.example.yaml` 原先用 `JWT_SECRET`，但代码要求的是 `JWT_ACCESS_SECRET`（且 Joi 校验 ≥32 字符）。原值会导致校验失败、容器无法启动。已改名并补足长度。

2. **`APP_PORT` / `API_PREFIX` 与 `*_API_PORT` / `*_API_PREFIX` 并存**：`appConfig` 读取 `APP_PORT` / `API_PREFIX`，但各 app 实际监听端口与路由前缀取自 `ADMIN_API_PORT` / `USER_API_PORT` 与 `ADMIN_API_PREFIX` / `USER_API_PREFIX`（`main.ts` / `setup-app.ts` 直接读）。`APP_PORT` 目前仅影响 `app.baseUrl` 默认拼接。**配置端口请用 `*_API_PORT`**。（未改动代码，仅说明。）

3. **i18n 环境变量当前不生效**：`i18n.config.ts` 使用常量（`I18N_CONSTANTS`），并不读取 `I18N_DEFAULT_LANGUAGE` / `DEFAULT_LANGUAGE`。k8s configmap 的 `DEFAULT_LANGUAGE` 目前是「占位/无效」，待 i18n 改为读 env 后才生效。（未改动代码，仅说明。）

4. **`WORKER_HEALTH_PORT` 暂未被消费**：worker 尚未实现独立健康探针端口，代码未读取该变量，保留为占位。

5. **每个 env 文件都是自包含的**：dev 模式只加载 `env/<APP_NAME>.local.env` 单个文件，docker 各服务也只 `env_file` 单个文件，因此每份文件都写全了所需变量（包括 worker 也要带 JWT 密钥以通过校验）。
