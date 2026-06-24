/**
 * @core/logger — 基于 pino 的结构化日志
 *
 * 自动注入请求上下文（requestId/traceId/用户/IP），输出前对敏感字段脱敏。
 */
export * from './logger.types';
export * from './logger.service';
export * from './logger.interceptor';
export * from './logger.module';
