# QUEUE-SPEC

Asynchronous work runs through BullMQ (`@platform/queue`, backed by ioredis).
Apps **enqueue**; the **worker** consumes. No long-running work in a request
handler.

## Names are constants, never strings

`@platform/queue` centralizes names so producer and consumer never drift:

- `QUEUE_NAMES`: `AUDIT`, `USER_EVENTS`, `SSO_SYNC`, `TASK`, `SYSTEM`.
- `JOB_NAMES[<QUEUE>][<JOB>]`: e.g. `JOB_NAMES.AUDIT.WRITE_OPERATION_LOG`,
  `JOB_NAMES.USER_EVENTS.USER_REGISTERED`, `JOB_NAMES.SSO_SYNC.SYNC_PROFILE`,
  `JOB_NAMES.TASK.EXECUTE` / `RETRY`, `JOB_NAMES.SYSTEM.CLEANUP`.

`ALL_QUEUE_NAMES` is used by the worker to register every queue.

## Producer (apps / libs)

Inject `QueueProducer` and enqueue by queue + job name with a typed payload:

```typescript
await this.queueProducer.enqueue(
  QUEUE_NAMES.USER_EVENTS,
  JOB_NAMES.USER_EVENTS.USER_REGISTERED,
  { userUid } satisfies UserRegisteredJob,
);
```

Payloads are plain serializable objects (job payload types live in
`@platform/queue` `queue.types`). Never enqueue an entity or a class instance.

## Consumer (worker only)

Processors live in `apps/worker/src/processors/<area>/*.processor.ts`, one per
queue, extending `BaseQueueProcessor`. The processor switches on `job.name`:

```typescript
@Processor(QUEUE_NAMES.USER_EVENTS)
export class UserEventsProcessor extends BaseQueueProcessor {
  async process(job: Job): Promise<void> {
    switch (job.name) {
      case JOB_NAMES.USER_EVENTS.USER_REGISTERED:
        return this.onRegistered(job.data);
      case JOB_NAMES.USER_EVENTS.USER_LOGGED_IN:
        return this.onLoggedIn(job.data);
      default:
        throw new Error(`Unknown job: ${job.name}`);
    }
  }
}
```

An unknown job name **throws** (so BullMQ retries/fails it) rather than silently
returning.

## When to enqueue

Enqueue (don't do inline) when work is: slow, retryable, fire-and-forget, or a
side effect of a write (audit logging, notifications, profile sync, cleanup).
The audit interceptor and task service are the main producers; see AUDIT-SPEC.md
and TASK-SPEC.md.

## Retries and idempotency

Configure attempts/backoff on enqueue. Processors must be **idempotent** — a job
may run more than once. Cron-style scheduled jobs are defined in
`apps/worker/src/schedules/*.schedule.ts` and run on a single worker instance.

## Reliability fallbacks (task queue)

Direct enqueue is the **fast path**; two cron-driven fallbacks guarantee delivery
and recover stuck work for `@platform/task`:

- **Pending dispatcher** (`task-dispatch.schedule.ts`, ~15s): rescans tasks in
  `PENDING` / `RETRYING` whose `dispatched_at` is NULL or older than the lease
  grace window (enqueue may have been lost on a crash / Redis blip) and re-enqueues
  each with `jobId=task.uid` (BullMQ dedupes). `TaskService.createAndEnqueue`
  stamps `dispatched_at` on success so freshly enqueued tasks are not re-dispatched.
- **Stale recovery** (`task-stale-recovery.schedule.ts`, ~5min):
  `TaskService.recoverStaleTasks` scans `RUNNING` tasks whose `locked_at` is older
  than the stale threshold (worker crashed mid-run) and, via a CAS keyed on
  `uid + status + locked_at`, resets them to `RETRYING` (attempts left) or `FAILED`
  with error code `TASK_STALE_TIMEOUT` (attempts exhausted).

Workers stamp `locked_by` (workerId / hostname) + `locked_at` on `claim()`.
Thresholds default to `TASK_RELIABILITY_DEFAULTS` (`@core/config`) — TODO: expose
as env config.

## Dead-letter queue (DLQ)

`QUEUE_NAMES.DEAD_LETTER` + `JOB_NAMES.DEAD_LETTER.RECORD` capture jobs that have
**exhausted their retries** (`attemptsMade >= opts.attempts`) so they are not
silently dropped. `QueueProducer.enqueueDeadLetter(entry: DeadLetterJobData)`
forwards the origin queue / job name / payload / failure reason for manual triage
or replay (DLQ records are not retried and kept indefinitely).

A processor opts in via a `failed` worker event when retries are exhausted:

```typescript
@OnWorkerEvent('failed')
async onFailed(job: Job, err: Error): Promise<void> {
  if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await this.queueProducer.enqueueDeadLetter({
      originQueue: job.queueName,
      originJobName: job.name,
      originJobId: job.id ?? null,
      originData: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: err?.message ?? job.failedReason ?? null,
      deadLetteredAt: new Date().toISOString(),
    });
  }
}
```

The DLQ queue auto-registers (it is in `ALL_QUEUE_NAMES`). The base
`BaseQueueProcessor` intentionally does **not** auto-forward, to avoid forcing a
`QueueProducer` dependency into every processor constructor; opt in per processor
where dead-lettering matters (e.g. the `task` queue).
