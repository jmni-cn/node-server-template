import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { BusinessException } from '../exceptions/business.exception';

/** 最小日志接口，避免 @core/common 反向依赖 @core/logger。 */
export interface MinimalErrorLogger {
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * 鉴权 / 刷新等链路的统一异常处理：
 *  - `BusinessException` / `HttpException`（含 401/403/业务错误）→ 原样抛出（确定性失败）；
 *  - 其余（基础设施 / DB 错误，如连接池 `ECONNRESET` → `QueryFailedError`）→ 记日志并抛
 *    `ServiceUnavailableException`（503，可重试），避免被误判为"令牌无效"或冒泡成 500
 *    把用户误踢去重新登录。
 *
 * 用法：`try { ... } catch (err) { throwInfraErrorAs503(err, this.logger, 'AuthService.refreshToken'); }`
 */
export function throwInfraErrorAs503(
  err: unknown,
  logger: MinimalErrorLogger,
  context: string,
): never {
  if (err instanceof BusinessException || err instanceof HttpException) {
    throw err;
  }
  logger.error(`${context}: infrastructure error`, {
    error: err instanceof Error ? err.message : String(err),
  });
  throw new ServiceUnavailableException('服务暂时不可用，请稍后重试');
}
