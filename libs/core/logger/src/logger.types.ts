/**
 * @core/logger 类型定义。
 */

/**
 * 日志数据结构处理器类型。
 * 在日志输出前对日志对象做自定义处理（如附加字段、脱敏等）。
 */
export type LogDataProcessor = (
  logData: Record<string, unknown>,
) => Record<string, unknown>;
