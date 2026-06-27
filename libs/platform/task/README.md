# @platform/task

通用富任务引擎。提供任务的创建（支持事务上下文 / 幂等去重）、入队、CAS 状态流转、派发租约兜底、卡死任务自愈、多维查询、重试、保留清理与日志能力；任务执行通过 `@platform/queue` 的 `task` 队列异步分发。

> 模板保持通用：任务类型 `type` 与来源 `sourceType` 均为通用字符串，由调用方传值；本库**不内置任何业务枚举**。

## 实体 / 表

| 实体      | 表名         | 基类               | uidPrefix  |
| --------- | ------------ | ------------------ | ---------- |
| `Task`    | `tasks`      | `BaseEntity`       | `task`     |
| `TaskLog` | `task_logs`  | `SystemBaseEntity` | `tasklog`  |

- `Task`（富字段）：`type`、`name?`、`bizType?`、`bizUid?`、`status`、`priority`、`attempt`、`maxAttempt`、`dedupKey?`（唯一）、`targetVersion?`、`requestedVersion?`、`resolvedVersion?`、`dependsOnTaskUid?`、`blockReason?`、`queueName?`、`workerId?`、`scheduledAt?`、`startedAt?`、`finishedAt?`、`lockedBy?`、`lockedAt?`、`dispatchedAt?`、`inputJson?`、`stagesJson?`、`outputJson?`、`errorCode?`、`errorMessage?`、`sourceType?`、`traceId?`。
- `TaskLog`：`taskUid`（索引）、`level`（`info`|`warn`|`error`）、`message`。

## 状态生命周期（TaskStatus，值为小写字符串）

```
PENDING ──claim──> PROCESSING ──complete──> SUCCESS
                              └──fail──────> FAILED（重试耗尽）
                              └──fail──────> RETRYING（尚有次数）──dispatch──> PROCESSING ...
PENDING / RETRYING ──cancel──> CANCELLED
非终态 ──skip──> SKIPPED
```

终态：`SUCCESS` / `FAILED` / `CANCELLED` / `SKIPPED`（可被 retention 清理）。

## 服务

- `TaskService`：
  - 创建：`createTask`（支持 `{ manager }` 事务上下文 + dedupKey 幂等）、`createTaskInTransaction`、`createAndEnqueue`（创建并投递 + 标记派发租约）。
  - CAS 状态流转：`claimTask`（悲观锁，抢不到抛错）、`tryClaimTask`（幂等抢占，抢不到返回 null）、`completeTask`（幂等）、`failTask`（幂等，按剩余次数 RETRYING/FAILED）、`cancelTask`、`retryTask`、`skipTask`。
  - 派发 / 自愈：`findPendingTasks(type, limit)`、`findPendingForDispatch(limit?)`（类型无关）、`markDispatched`、`recoverStaleTasks`（卡死 PROCESSING 自愈）。
  - 查询：`listTasks`（多维过滤分页，返回 `[Task[], total]`）、`getByUid`（不存在抛错）、`findByUid`、`findByDedupKey`、`listByBiz`、`updateStages`。
  - 日志：`addLog`。
- `TaskQueryService`：`query`（简单分页 + 过滤，返回 VO 分页）、`getLogs`。
- `TaskRetryService`：`retry`（仅 `FAILED` 可重试，受 `maxAttempt` 限制，主动重新入队）。
- `TaskRetentionService`：`cleanupTerminalTasks`（按保留期软删除终态任务，SUCCESS / 其它终态可分别配置保留天数，支持 dryRun）。
- `TaskAssembler`：`toPageResult`，组装列表分页 VO。

## 队列 / Job

- 队列：`QUEUE_NAMES.TASK`（`'task'`）。
- Job：
  - `JOB_NAMES.TASK.EXECUTE`（`'execute-task'`）— 首次执行入队。
  - `JOB_NAMES.TASK.RETRY`（`'retry-task'`）— 重试入队。
- 负载类型：`TaskJobData { taskUid, type, payload? }`。

## 错误码

`TASK_NOT_FOUND` (404)、`TASK_INVALID_STATE` (409)、`TASK_MAX_ATTEMPTS` (409)、`TASK_ENQUEUE_FAILED` (500)、`TASK_STALE_TIMEOUT` (500)、`TASK_STALE_RECOVERED` (500)。
模块加载时通过 `registerErrorCodeHttpStatus` 注册映射。
