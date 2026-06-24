# @platform/queue

BullMQ queue infrastructure for the platform layer.

## Provides

- **`QueueModule.forRoot(queues?)`** — registers the global BullMQ connection (from `queueConfig` in `@core/config`) + the given queues + `QueueProducer`. Defaults to all `QUEUE_NAMES`. Import once per process.
- **`QueueModule.registerQueues(names)`** — register a subset of queues in a feature module.
- **`QueueProducer`** — generic `enqueue(queueName, jobName, data, opts)` / `enqueueBulk(...)`. Resolves queues lazily via `ModuleRef`.
- **`BaseQueueProcessor`** — abstract worker base; subclass with `@Processor(QUEUE_NAMES.X)` and a `handlers` map keyed by job name.
- **`QUEUE_NAMES`** / **`ALL_QUEUE_NAMES`** / **`JOB_NAMES`** — shared name constants for producers (apps) and processors (worker).
- **Job payload types** — `OperationLogJobData`, `UserEventJobData`, `SsoSyncJobData`, `TaskJobData`, `EnqueueOptions`.

## Queue & job names

```
QUEUE_NAMES.AUDIT       = 'audit'        JOB_NAMES.AUDIT.WRITE_OPERATION_LOG
QUEUE_NAMES.USER_EVENTS = 'user-events'  JOB_NAMES.USER_EVENTS.{USER_REGISTERED,USER_LOGGED_IN,PASSWORD_CHANGED}
QUEUE_NAMES.SSO_SYNC    = 'sso-sync'     JOB_NAMES.SSO_SYNC.SYNC_PROFILE
QUEUE_NAMES.TASK        = 'task'         JOB_NAMES.TASK.{EXECUTE,RETRY}
QUEUE_NAMES.SYSTEM      = 'system'       JOB_NAMES.SYSTEM.CLEANUP
```

## Layer

`@platform/queue` depends only on `@core/config`. Consumed by `@platform/audit`, `@platform/task`, apps, and worker.
