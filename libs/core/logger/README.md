# @core/logger

Structured logging on **pino**.

## Exports
- `LoggerModule` — global; provides `LoggerService` (TRANSIENT scope, shared pino instance) and `LoggerInterceptor`.
- `LoggerService` — NestJS `LoggerService` impl; auto-injects request context (requestId/traceId/user/ip) from `@core/request-context` and redacts sensitive fields via `@core/common`'s `DataMaskingUtil`. Configured by `loggerConfig` from `@core/config`.
- `LoggerInterceptor` — request/response timing logs (skips health-check paths).
- `LogDataProcessor` type for custom log transforms.
