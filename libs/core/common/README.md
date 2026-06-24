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
- **Utils**: `generatePrefixedUid` (nanoid, used by base entities), `generateLowercaseUid`, `generateDatePrefixedUid`, datetime helpers, `CryptoUtil`, `DataMaskingUtil`, `maskIp` / `hashUserAgent`.

## Error code registry
Business libs define their own `*-error-codes.ts` enum + HTTP map and register it:
```ts
import { registerErrorCodeHttpStatus } from '@core/common';
registerErrorCodeHttpStatus(MyErrorCodeHttpStatus);
```
