# @core/common

Cross-cutting HTTP & utility primitives shared by every layer.

## Exports
- **VO**: `BaseResponseVo`, `BaseResponse`, `SuccessVo`, `ErrorResponseVo`, `PageMetaVo`, `PageResultVo`, `createPageResult`, health VOs.
- **DTO**: `PaginationDto`.
- **Exceptions**: `BusinessException`, `isKnownErrorCode`.
- **Error codes**: `BaseErrorCode` + `BaseErrorCodeHttpStatus`, `CommonBusinessErrorCode`, the extensible `ErrorCodeHttpStatus` registry, `registerErrorCodeHttpStatus(map)`, `getHttpStatusByErrorCode(code)`.
- **Filters**: `AllExceptionsFilter` (i18n error envelope; optionally injects `@core/logger` + `@core/request-context`).
- **Interceptors**: `TransformInterceptor` (unified success envelope), `LoggingInterceptor`.
- **Decorators**: `@ApiBaseResponse` / `@ApiArrayResponse` / `@ApiPaginatedResponse` / `@ApiSuccessResponse`, `@Public()` + `IS_PUBLIC_KEY`.
- **Utils**:
  - **id / random**: `generatePrefixedUid` (nanoid, used by base entities), `generateLowercaseUid`, `generateDatePrefixedUid`, `generateSecureToken`, `generateNumericCode`.
  - **datetime**: UTC helpers — `nowUtc`, `toIsoUtc`, `parseIsoInstantToUtcDate`, `parseLocalDateRangeToUtcRange`.
  - **crypto / masking**: `CryptoUtil` (AES-256-GCM), `DataMaskingUtil`, `maskIp`, `hashUserAgent`.
  - **error**: `throwInfraErrorAs503` (确定性失败原样抛出，基础设施错误转 503 可重试).
  - **object / type-guards**: `isNil`, `isNotNil`, `isPlainObject`, `isEmptyObject`, `pick`, `omit`, `removeNullish` — 供 mapper / assembler / DTO 构建与裁剪对象（均返回新对象，无副作用）。
  - **async**: `sleep`, `withTimeout` (+ `TimeoutError`), `retry` (指数退避) — 供 worker / queue / SSO / health 节流、限时、瞬时故障重试。

## Response envelope

Success（`TransformInterceptor`）与 error（`AllExceptionsFilter`）响应字段对称，
均带 `requestId` 与 `traceId`：优先取请求头 `x-request-id` / `x-trace-id`，
回退到 `RequestContextService`（AsyncLocalStorage），保证全链路可追踪。

## Error code registry
Business libs define their own `*-error-codes.ts` enum + HTTP map and register it:
```ts
import { registerErrorCodeHttpStatus } from '@core/common';
registerErrorCodeHttpStatus(MyErrorCodeHttpStatus);
```
