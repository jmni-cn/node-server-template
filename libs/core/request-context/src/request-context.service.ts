import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import type {
  GeoLocation,
  ParsedDeviceInfo,
  RequestContextData,
} from './request-context.types';

/**
 * 请求上下文服务。
 * 使用 AsyncLocalStorage 在整个请求生命周期中传递上下文数据，
 * Service 层可直接获取当前请求的 requestId、traceId、用户信息等。
 *
 * 同时提供静态方法（无需注入）与实例方法（便于 DI）。
 */
@Injectable()
export class RequestContextService {
  private static storage = new AsyncLocalStorage<RequestContextData>();

  /** 在请求上下文中运行回调 */
  static run<T>(data: RequestContextData, callback: () => T): T {
    return this.storage.run(data, callback);
  }

  /** 获取当前请求上下文 */
  static getContext(): RequestContextData | undefined {
    return this.storage.getStore();
  }

  static getRequestId(): string | undefined {
    return this.storage.getStore()?.requestId;
  }

  static getTraceId(): string | undefined {
    return this.storage.getStore()?.traceId;
  }

  static getSub(): string | undefined {
    return this.storage.getStore()?.sub;
  }

  static getUsername(): string | undefined {
    return this.storage.getStore()?.username;
  }

  static getJti(): string | undefined {
    return this.storage.getStore()?.jti;
  }

  static getIp(): string | undefined {
    return this.storage.getStore()?.ip;
  }

  static getStartTime(): number | undefined {
    return this.storage.getStore()?.startTime;
  }

  static getUserAgent(): string | undefined {
    return this.storage.getStore()?.userAgent;
  }

  static getDeviceInfo(): ParsedDeviceInfo | undefined {
    return this.storage.getStore()?.deviceInfo;
  }

  static getGeoLocation(): GeoLocation | undefined {
    return this.storage.getStore()?.geoLocation;
  }

  /**
   * 更新当前上下文中的用户信息（通常在认证通过后调用）。
   */
  static setUser(userInfo: {
    sub: string;
    username: string;
    jti?: string;
  }): void {
    const context = this.storage.getStore();
    if (context) {
      context.sub = userInfo.sub;
      context.username = userInfo.username;
      context.jti = userInfo.jti;
    }
  }

  // ============ 实例方法（用于依赖注入）============

  getContext(): RequestContextData | undefined {
    return RequestContextService.getContext();
  }

  getRequestId(): string | undefined {
    return RequestContextService.getRequestId();
  }

  getTraceId(): string | undefined {
    return RequestContextService.getTraceId();
  }

  getSub(): string | undefined {
    return RequestContextService.getSub();
  }

  getUsername(): string | undefined {
    return RequestContextService.getUsername();
  }

  getJti(): string | undefined {
    return RequestContextService.getJti();
  }

  getIp(): string | undefined {
    return RequestContextService.getIp();
  }

  getUserAgent(): string | undefined {
    return RequestContextService.getUserAgent();
  }

  getDeviceInfo(): ParsedDeviceInfo | undefined {
    return RequestContextService.getDeviceInfo();
  }

  getGeoLocation(): GeoLocation | undefined {
    return RequestContextService.getGeoLocation();
  }

  setUser(userInfo: { sub: string; username: string; jti?: string }): void {
    RequestContextService.setUser(userInfo);
  }
}
