# worker

后台 worker 进程（NestJS application context，无公开 HTTP 服务）。消费 BullMQ
队列并执行 `@nestjs/schedule` cron。

## 启动

```bash
npm run start:dev:worker
npm run build:worker && npm run start:worker
```

环境变量见根目录 `.env.example` + `.env.worker.example`：

- `WORKER_CONCURRENCY`（默认 5）：每个 processor 的并发度。
- `WORKER_ENABLE_SCHEDULE`（默认 true）：关闭则不注册 cron schedules。
- `WORKER_HEALTH_PORT`（默认 3003）：可选健康探针端口（本模板默认不挂载 HTTP，
  保持进程最小；如需健康端点，可在 `main.ts` 改用 Fastify 健康应用）。

## 队列与处理器（每队列单 WorkerHost）

| 队列 (`QUEUE_NAMES`) | WorkerHost | 处理的 job |
|----------------------|------------|------------|
| `audit` | `AuditLogProcessor` | `write-operation-log` → 落库 |
| `user-events` | `UserRegisteredProcessor` | `user-registered` / `user-logged-in`（委托 `UserLoginProcessor`） / `password-changed` |
| `sso-sync` | `SsoProfileSyncProcessor` | `sync-profile` → 外部身份对账 |
| `task` | `TaskRetryProcessor` | `execute-task` / `retry-task` |
| `system` | `SystemMaintenanceProcessor` | `cleanup`（委托 `TaskCleanupProcessor`） |

> BullMQ 约定每个队列仅能有一个 `WorkerHost`。`UserLoginProcessor` 与
> `TaskCleanupProcessor` 因此实现为 `@Injectable` 协作者，由对应队列的 WorkerHost
> 按 job 名委托调用，而非各自再 `@Processor` 同一队列（否则冲突）。

## 调度（cron）

| Schedule | 频率 | 行为 |
|----------|------|------|
| `CleanupSchedule` | 每日 02:00 | 入队 `system/cleanup` |
| `SystemMaintenanceSchedule` | 每小时 | 入队 `system/cleanup` |

调度只负责入队，重活在 processor 中执行（"长任务走队列"）。

## 约束

worker 不暴露业务 HTTP，不注入 Repository，调用 domain/platform 服务完成落库与
状态流转。无 AI 相关逻辑。
