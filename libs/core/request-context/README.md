# @core/request-context

`AsyncLocalStorage`-backed request context. Holds requestId / traceId / user / ip / device info
across the request lifecycle. **Zero `@core` dependencies** to avoid a cycle with `@core/common`.

## Exports
- `RequestContextModule` — global; provides `RequestContextService`.
- `RequestContextService` — static + instance accessors (`getRequestId`, `getTraceId`, `getContext`, `setUser`, ...).
- `RequestContextMiddleware` — initializes context per request (Fastify), sets `X-Request-ID` / `X-Trace-ID`.
- `RequestContextInterceptor` — interceptor alternative to the middleware (use one, not both).
- Types: `RequestContextData`, `ParsedDeviceInfo`, `GeoLocation`. Utils: `getRequestId`, `getTraceId`, `getClientIp`, `parseUserAgent`.
