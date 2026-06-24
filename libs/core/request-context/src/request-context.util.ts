/**
 * 请求上下文工具：requestId/traceId 提取、客户端 IP 解析、User-Agent 解析。
 *
 * 依赖保持轻量：仅使用 uuid 与 ua-parser-js（均为根 package 依赖）。
 */
import { UAParser } from 'ua-parser-js';
import { v4 as uuidv4 } from 'uuid';
import type { FastifyRequest } from 'fastify';
import type { ParsedDeviceInfo } from './request-context.types';

/** 与 FastifyRequest 兼容的最小请求形状（也兼容 Node http.IncomingMessage） */
type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
};

/**
 * 生成请求唯一标识。
 */
export function generateRequestId(): string {
  return uuidv4();
}

/**
 * 从请求中获取客户端 IP（支持 X-Forwarded-For / X-Real-IP 代理转发）。
 */
export function getClientIp(request: RequestLike): string | null {
  const xForwardedFor = request.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = Array.isArray(xForwardedFor)
      ? xForwardedFor[0]
      : xForwardedFor.split(',')[0];
    return ips?.trim() || null;
  }

  const xRealIp = request.headers['x-real-ip'];
  if (xRealIp) {
    return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
  }

  return request.ip || null;
}

/**
 * 从请求头获取或生成 traceId。
 */
export function getTraceId(request: RequestLike): string {
  const headerNames = ['x-trace-id', 'trace-id'];
  for (const name of headerNames) {
    const value = request.headers[name];
    if (value) {
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return generateRequestId();
}

/**
 * 从请求头获取或生成 requestId。
 */
export function getRequestId(request: RequestLike): string {
  const headerNames = [
    'x-request-id',
    'x-correlation-id',
    'request-id',
    'correlation-id',
  ];
  for (const name of headerNames) {
    const value = request.headers[name];
    if (value) {
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return generateRequestId();
}

/**
 * 解析 User-Agent 获取设备信息。
 */
export function parseUserAgent(userAgent: string | null): ParsedDeviceInfo {
  const defaultResult: ParsedDeviceInfo = {
    deviceType: 'unknown',
    browser: null,
    browserVersion: null,
    os: null,
    osVersion: null,
  };

  if (!userAgent) return defaultResult;

  try {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    let deviceType: ParsedDeviceInfo['deviceType'] = 'unknown';
    const device = result.device;
    const ua = userAgent.toLowerCase();

    if (
      ua.includes('bot') ||
      ua.includes('crawler') ||
      ua.includes('spider') ||
      ua.includes('curl') ||
      ua.includes('wget') ||
      ua.includes('postman')
    ) {
      deviceType = 'bot';
    } else if (device.type === 'mobile') {
      deviceType = 'mobile';
    } else if (device.type === 'tablet') {
      deviceType = 'tablet';
    } else if (result.browser.name) {
      deviceType = 'desktop';
    }

    return {
      deviceType,
      browser: result.browser.name || null,
      browserVersion: result.browser.version || null,
      os: result.os.name || null,
      osVersion: result.os.version || null,
    };
  } catch {
    return defaultResult;
  }
}

/** FastifyRequest 适配的便捷封装 */
export function buildRequestContextFromHeaders(req: FastifyRequest['raw']): {
  requestId: string;
  traceId: string;
  ip: string | undefined;
  userAgent: string | undefined;
  deviceInfo: ParsedDeviceInfo;
} {
  const like = req as unknown as RequestLike;
  const requestId = getRequestId(like);
  const traceId = getTraceId(like);
  const ip = getClientIp(like) || undefined;
  const userAgent = (req.headers['user-agent'] as string) || undefined;
  const deviceInfo = parseUserAgent(userAgent || null);
  return { requestId, traceId, ip, userAgent, deviceInfo };
}
