import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';
import { LOGGER_DEFAULTS, LOGGER_CONSTANTS } from './constants';

function parseLogCustomFields(): Record<string, unknown> {
  const raw = process.env.LOG_CUSTOM_FIELDS;
  if (!raw || !raw.trim()) {
    return {};
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * 日志配置命名空间
 */
export const loggerConfig = registerAs('logger', () => {
  const customFields: Record<string, unknown> = { ...parseLogCustomFields() };
  const serviceName = process.env.SERVICE_NAME || process.env.APP_NAME;
  if (serviceName) {
    customFields.service = serviceName;
  }

  return {
    /** 日志级别 */
    level: process.env.LOG_LEVEL ?? LOGGER_DEFAULTS.LEVEL,
    /** 是否美化输出（开发环境） */
    prettyPrint: process.env.LOG_PRETTY_PRINT !== 'false',

    /** 是否输出到文件 */
    fileEnabled: process.env.LOG_FILE_ENABLED === 'true',
    dir: process.env.LOG_DIR ?? LOGGER_DEFAULTS.DIR,
    maxFiles: LOGGER_CONSTANTS.MAX_FILES,
    maxSize: LOGGER_CONSTANTS.MAX_SIZE,

    // 日志文件名配置
    appLogFile: process.env.LOG_APP_FILE ?? LOGGER_DEFAULTS.APP_LOG_FILE,
    errorLogFile: process.env.LOG_ERROR_FILE ?? LOGGER_DEFAULTS.ERROR_LOG_FILE,

    // 数据结构处理配置
    includeTimestamp: LOGGER_CONSTANTS.INCLUDE_TIMESTAMP,
    includePid: LOGGER_CONSTANTS.INCLUDE_PID,
    includeHostname: LOGGER_CONSTANTS.INCLUDE_HOSTNAME,
    customFields,
  };
});

/**
 * 日志配置接口
 */
export interface LoggerConfigType {
  // 基础配置
  level: string;
  prettyPrint: boolean;

  // 文件输出配置
  fileEnabled: boolean;
  dir: string;
  maxFiles: number;
  maxSize: string;

  // 日志文件名配置
  appLogFile: string;
  errorLogFile: string;

  // 数据结构处理配置
  includeTimestamp: boolean;
  includePid: boolean;
  includeHostname: boolean;
  customFields: Record<string, unknown>;
}

/**
 * 日志配置验证 Schema
 */
export const loggerConfigSchema = {
  LOG_LEVEL: Joi.string()
    .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal')
    .default(LOGGER_DEFAULTS.LEVEL)
    .description('日志级别'),
  LOG_PRETTY_PRINT: Joi.boolean()
    .default(LOGGER_DEFAULTS.PRETTY_PRINT)
    .description('是否美化日志输出（开发环境推荐开启）'),

  // 文件输出配置
  LOG_FILE_ENABLED: Joi.boolean()
    .default(LOGGER_DEFAULTS.FILE_ENABLED)
    .description('是否启用文件日志输出'),
  LOG_DIR: Joi.string()
    .default(LOGGER_DEFAULTS.DIR)
    .description('日志文件输出目录'),
  LOG_MAX_FILES: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .default(LOGGER_CONSTANTS.MAX_FILES)
    .description('日志文件保留天数/数量'),
  LOG_MAX_SIZE: Joi.string()
    .pattern(/^\d+[kmg]?$/i)
    .default(LOGGER_CONSTANTS.MAX_SIZE)
    .description('单个日志文件最大大小（如：10m, 100k, 1g）'),

  // 日志文件名配置
  LOG_APP_FILE: Joi.string()
    .default(LOGGER_DEFAULTS.APP_LOG_FILE)
    .description('应用日志文件名'),
  LOG_ERROR_FILE: Joi.string()
    .default(LOGGER_DEFAULTS.ERROR_LOG_FILE)
    .description('错误日志文件名'),

  // 数据结构处理配置
  LOG_INCLUDE_TIMESTAMP: Joi.boolean()
    .default(LOGGER_CONSTANTS.INCLUDE_TIMESTAMP)
    .description('日志是否包含时间戳'),
  LOG_INCLUDE_PID: Joi.boolean()
    .default(LOGGER_CONSTANTS.INCLUDE_PID)
    .description('日志是否包含进程ID'),
  LOG_INCLUDE_HOSTNAME: Joi.boolean()
    .default(LOGGER_CONSTANTS.INCLUDE_HOSTNAME)
    .description('日志是否包含主机名'),
  LOG_CUSTOM_FIELDS: Joi.string()
    .default('{}')
    .description('自定义日志字段（JSON格式）'),
};
