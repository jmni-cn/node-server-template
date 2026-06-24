# TASK-SPEC

`@platform/task` is a generic, persisted async-task facility: a `Task` row tracks
the lifecycle of a unit of background work that is executed on the worker via the
`TASK` queue. Use it when you need a durable, queryable, retryable record of a
job (vs. a fire-and-forget queue message).

## Task entity & lifecycle

A `Task` carries: type, payload, status, attempts/maxAttempts, result/error, and
timestamps (extends `BaseEntity`, uid-prefixed; see CONVENTIONS.md §6).

`TaskStatus` lifecycle:

```
PENDING ──enqueue──▶ RUNNING ──┬─▶ SUCCESS
                                └─▶ FAILED ──retry──▶ RETRYING ──▶ RUNNING ──▶ ...
```

- **PENDING** — created, not yet picked up.
- **RUNNING** — claimed by a worker processor.
- **SUCCESS** — completed; result stored.
- **FAILED** — errored; error stored.
- **RETRYING** — scheduled for another attempt (FAILED → retry).

## Flow

1. A service calls `TaskService.create(...)` → row in `PENDING`, then enqueues
   `JOB_NAMES.TASK.EXECUTE` on `QUEUE_NAMES.TASK` with the task uid.
2. The worker's task processor loads the task, marks `RUNNING`, runs the handler
   for the task type, and records `SUCCESS`/`FAILED`.
3. On failure within `maxAttempts`, the task goes `RETRYING` and a
   `JOB_NAMES.TASK.RETRY` job is enqueued (backoff). Exceeding `maxAttempts`
   leaves it `FAILED` (`TASK_MAX_ATTEMPTS`).

## Manual trigger

admin-api exposes `/admin/tasks` to list, inspect, and **manually retry** a task.
A manual retry of a non-failed task is rejected with `TASK_INVALID_STATE`.

## Rules

- Status transitions go through `TaskService` — never mutate `status` from an
  app or a controller.
- Task handlers are idempotent (a task may be retried).
- Long work belongs in the handler on the worker, never in the producing request.

## Error codes

`TASK_NOT_FOUND` (404), `TASK_INVALID_STATE` (409), `TASK_MAX_ATTEMPTS` (409),
`TASK_ENQUEUE_FAILED` (500).
