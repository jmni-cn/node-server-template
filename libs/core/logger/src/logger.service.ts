import {
  Injectable,
  Inject,
  LoggerService as NestLoggerService,
  OnModuleInit,
  Scope,
} from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import pino, { Logger, TransportTargetOptions } from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loggerConfig } from '@core/config';
import { RequestContextService } from '@core/request-context';
import { DataMaskingUtil } from '@core/common';
import type { LogDataProcessor } from './logger.types';

export type { LogDataProcessor } from './logger.types';

/**
 * Pino 日志服务，实现 NestJS LoggerService 接口。
 * 支持文件输出和自定义数据结构处理。
 *
 * 使用 TRANSIENT 作用域：每个消费者类获得独立实例，setContext() 不会污染其他类。
 * 底层 Pino Logger 通过静态字段共享，避免重复创建文件句柄。
 */
@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService, OnModuleInit {
  private static sharedLogger: Logger | null = null;
  private static logDirEnsured = false;

  private context?: string;
  private dataProcessors: LogDataProcessor[] = [];

  constructor(
    @Inject(loggerConfig.KEY)
    private readonly config: ConfigType<typeof loggerConfig>,
  ) {
    if (!LoggerService.sharedLogger) {
      LoggerService.sharedLogger = this.createLogger();
    }
  }

  private get logger(): Logger {
    return LoggerService.sharedLogger!;
  }

  onModuleInit(): void {
    if (this.config.fileEnabled && !LoggerService.logDirEnsured) {
      this.ensureLogDirectory();
      LoggerService.logDirEnsured = true;
    }
  }

  private ensureLogDirectory(): void {
    const logDir = path.resolve(this.config.dir);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private createLogger(): Logger {
    const config = this.config;

    const baseConfig: pino.LoggerOptions = {
      level: config.level,
      timestamp: config.includeTimestamp
        ? pino.stdTimeFunctions.isoTime
        : false,
      base: this.getBaseFields(),
    };

    if (config.fileEnabled) {
      const targets: TransportTargetOptions[] = [];
      const logDir = path.resolve(config.dir);

      if (config.prettyPrint) {
        targets.push({
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: this.getIgnoredFields(),
          },
          level: config.level,
        });
      } else {
        targets.push({
          target: 'pino/file',
          options: { destination: 1 }, // stdout
          level: config.level,
        });
      }

      targets.push({
        target: 'pino/file',
        options: {
          destination: path.join(logDir, config.appLogFile),
          mkdir: true,
        },
        level: config.level,
      });

      targets.push({
        target: 'pino/file',
        options: {
          destination: path.join(logDir, config.errorLogFile),
          mkdir: true,
        },
        level: 'error',
      });

      return pino({
        ...baseConfig,
        transport: { targets },
      });
    }

    if (config.prettyPrint) {
      return pino({
        ...baseConfig,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: this.getIgnoredFields(),
          },
        },
      });
    }

    return pino({
      ...baseConfig,
      formatters: {
        level: (label) => ({ level: label }),
      },
    });
  }

  private getBaseFields(): Record<string, unknown> | undefined {
    const config = this.config;
    const fields: Record<string, unknown> = {};

    if (config.customFields && Object.keys(config.customFields).length > 0) {
      Object.assign(fields, config.customFields);
    }

    if (config.includePid) {
      fields.pid = process.pid;
    }
    if (config.includeHostname) {
      fields.hostname = os.hostname();
    }

    return Object.keys(fields).length > 0 ? fields : undefined;
  }

  private getIgnoredFields(): string {
    const ignored: string[] = [];
    if (!this.config.includePid) {
      ignored.push('pid');
    }
    if (!this.config.includeHostname) {
      ignored.push('hostname');
    }
    return ignored.join(',');
  }

  /** 设置日志上下文 */
  setContext(context: string): void {
    this.context = context;
  }

  /** 添加日志数据处理器 */
  addDataProcessor(processor: LogDataProcessor): void {
    this.dataProcessors.push(processor);
  }

  /** 移除日志数据处理器 */
  removeDataProcessor(processor: LogDataProcessor): boolean {
    const index = this.dataProcessors.indexOf(processor);
    if (index > -1) {
      this.dataProcessors.splice(index, 1);
      return true;
    }
    return false;
  }

  /** 清除所有数据处理器 */
  clearDataProcessors(): void {
    this.dataProcessors = [];
  }

  /**
   * 从 AsyncLocalStorage 获取请求上下文信息（requestId、用户信息、IP、设备信息等）。
   */
  private getRequestContext(): Record<string, unknown> {
    const ctx = RequestContextService.getContext();
    if (!ctx) {
      return {};
    }

    const contextData: Record<string, unknown> = {};

    if (ctx.requestId) {
      contextData.requestId = ctx.requestId;
    }
    if (ctx.traceId) {
      contextData.traceId = ctx.traceId;
    }
    if (ctx.jobUid) {
      contextData.jobUid = ctx.jobUid;
    }

    if (ctx.sub) {
      contextData.sub = ctx.sub;
    }
    if (ctx.username) {
      contextData.username = ctx.username;
    }
    if (ctx.jti) {
      contextData.jti = ctx.jti;
    }

    if (ctx.ip) {
      contextData.ipMasked = DataMaskingUtil.maskIp(ctx.ip) ?? undefined;
    }

    if (ctx.deviceInfo) {
      if (
        ctx.deviceInfo.deviceType &&
        ctx.deviceInfo.deviceType !== 'unknown'
      ) {
        contextData.deviceType = ctx.deviceInfo.deviceType;
      }
      if (ctx.deviceInfo.browser) {
        contextData.browser = ctx.deviceInfo.browser;
      }
      if (ctx.deviceInfo.os) {
        contextData.os = ctx.deviceInfo.os;
      }
    }

    if (ctx.geoLocation) {
      if (ctx.geoLocation.country) {
        contextData.country = ctx.geoLocation.country;
      }
      if (ctx.geoLocation.city) {
        contextData.city = ctx.geoLocation.city;
      }
    }

    return contextData;
  }

  /**
   * 创建带上下文的日志对象，自动注入请求上下文信息并执行脱敏。
   */
  private createLogObject(
    message: string,
    ...optionalParams: unknown[]
  ): object {
    let logObj: Record<string, unknown> = {
      context: this.context,
      message,
    };

    const requestContext = this.getRequestContext();
    Object.assign(logObj, requestContext);

    if (optionalParams.length > 0) {
      const lastParam = optionalParams[optionalParams.length - 1];

      if (typeof lastParam === 'string' && optionalParams.length > 0) {
        logObj.context = lastParam;
        optionalParams = optionalParams.slice(0, -1);
      }

      if (optionalParams.length > 0) {
        const firstParam = optionalParams[0];
        if (typeof firstParam === 'object' && firstParam !== null) {
          Object.assign(logObj, firstParam);
        } else if (optionalParams.length > 0) {
          logObj.params = optionalParams;
        }
      }
    }

    for (const processor of this.dataProcessors) {
      try {
        logObj = processor(logObj);
      } catch (error) {
        console.error('日志数据处理器执行错误:', error);
      }
    }

    // 自动脱敏：对 password / token / secret 等敏感字段值替换为 ***REDACTED***
    logObj = DataMaskingUtil.redactSensitiveKeys(logObj);

    return logObj;
  }

  log(message: string, ...optionalParams: unknown[]): void {
    this.logger.info(this.createLogObject(message, ...optionalParams));
  }

  error(message: string, ...optionalParams: unknown[]): void {
    const logObj = this.createLogObject(message) as Record<string, unknown>;

    if (optionalParams.length > 0) {
      const firstParam = optionalParams[0];
      if (firstParam instanceof Error) {
        logObj.err = {
          message: firstParam.message,
          stack: firstParam.stack,
          name: firstParam.name,
        };
      } else if (typeof firstParam === 'string') {
        if (firstParam.includes('\n') || firstParam.includes('at ')) {
          logObj.stack = firstParam;
        } else {
          logObj.context = firstParam;
        }
      } else if (typeof firstParam === 'object') {
        Object.assign(logObj, firstParam);
      }

      if (optionalParams.length > 1 && typeof optionalParams[1] === 'string') {
        logObj.context = optionalParams[1];
      }
    }

    // 错误路径单独构建了 err/stack 字段，须再次脱敏后写出。
    this.logger.error(DataMaskingUtil.redactSensitiveKeys(logObj));
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    this.logger.warn(this.createLogObject(message, ...optionalParams));
  }

  debug(message: string, ...optionalParams: unknown[]): void {
    this.logger.debug(this.createLogObject(message, ...optionalParams));
  }

  verbose(message: string, ...optionalParams: unknown[]): void {
    this.logger.trace(this.createLogObject(message, ...optionalParams));
  }

  fatal(message: string, ...optionalParams: unknown[]): void {
    this.logger.fatal(this.createLogObject(message, ...optionalParams));
  }

  /** 获取 pino 原始实例 */
  getPinoInstance(): Logger {
    return this.logger;
  }

  /** 创建子日志器 */
  child(bindings: Record<string, unknown>): Logger {
    return this.logger.child(bindings);
  }

  /** 获取当前日志配置 */
  getConfig(): ConfigType<typeof loggerConfig> {
    return this.config;
  }

  /** 获取日志目录路径 */
  getLogDirectory(): string {
    return path.resolve(this.config.dir);
  }
}
