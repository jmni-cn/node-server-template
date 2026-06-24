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
