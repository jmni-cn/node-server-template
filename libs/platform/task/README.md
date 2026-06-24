# @platform/task

通用异步任务库。提供任务的创建、入队、状态流转、查询与重试能力；任务执行通过 `@platform/queue` 的 `task` 队列异步分发。

## 实体 / 表

| 实体      | 表名         | 基类               | uidPrefix  |
| --------- | ------------ | ------------------ | ---------- |
| `Task`    | `tasks`      | `BaseEntity`       | `task`     |
| `TaskLog` | `task_logs`  | `SystemBaseEntity` | `tasklog`  |

- `Task`：`name`、`type`、`status`、`payload`、`attempts`、`maxAttempts`、`scheduledAt`、`startedAt`、`finishedAt`、`error`。
- `TaskLog`：`taskUid`（索引）、`level`（`info`|`warn`|`error`）、`message`。`createdAt` 由 `SystemBaseEntity` 提供。

## 状态生命周期（TaskStatus）

```
PENDING ──> RUNNING ──> SUCCESS
                  └───> FAILED ──> RETRYING ──> RUNNING ...
```

- `PENDING`：已创建，待执行。
- `RUNNING`：执行中（进入时递增 `attempts`）。
- `SUCCESS` / `FAILED`：终态，写入 `finishedAt`。
- `RETRYING`：失败任务重试时的中间态，重新入队后再次进入 `RUNNING`。

## 服务

- `TaskService`：`create`、`createAndEnqueue`、`findByUid`、`updateStatus`、`markRunning`、`markSuccess`、`markFailed`、`addLog`。
- `TaskQueryService`：`query`（分页 + 过滤）、`getLogs`。
- `TaskRetryService`：`retry`（仅 `FAILED` 可重试，受 `maxAttempts` 限制）。
- `TaskAssembler`：`toPageResult`，组装列表分页 VO。

## 队列 / Job

- 队列：`QUEUE_NAMES.TASK`（`'task'`）。
- Job：
  - `JOB_NAMES.TASK.EXECUTE`（`'execute-task'`）— 首次执行入队。
  - `JOB_NAMES.TASK.RETRY`（`'retry-task'`）— 重试入队。
- 负载类型：`TaskJobData { taskUid, type, payload? }`。

## 错误码

`TASK_NOT_FOUND` (404)、`TASK_INVALID_STATE` (409)、`TASK_MAX_ATTEMPTS` (409)、`TASK_ENQUEUE_FAILED` (500)。
模块加载时通过 `registerErrorCodeHttpStatus` 注册映射。
