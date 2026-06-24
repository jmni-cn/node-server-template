/**
 * @core/request-context 类型定义。
 *
 * 该 lib 刻意保持零 @core 依赖，避免与 @core/common 形成循环
 * （@core/common 的 AllExceptionsFilter 依赖本 lib）。
 */

/**
 * 地理位置信息。
 */
export interface GeoLocation {
  country: string | null;
  region: string | null;
  city: string | null;
}

/**
 * 解析后的设备信息（从 User-Agent 解析）。
 */
export interface ParsedDeviceInfo {
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
}

/**
 * 请求上下文数据结构。
 * 在中间件/拦截器中一次性解析并存储，供整个请求生命周期使用。
 *
 * 字段命名遵循 JWT/OIDC 标准：
 * - sub: Subject (用户唯一标识)
 * - jti: JWT ID (会话标识)
 */
export interface RequestContextData {
  /** 请求唯一标识 */
  requestId: string;
  /** 链路追踪标识（分布式追踪，通常由网关生成或透传） */
  traceId?: string;
  /** Worker / 异步任务侧业务 job 标识 */
  jobUid?: string;
  /** 用户标识 (Subject，认证后填充) */
  sub?: string;
  /** 用户名（认证后填充） */
  username?: string;
  /** 会话标识 (JWT ID，认证后填充) */
  jti?: string;
  /** 客户端 IP */
  ip?: string;
  /** User-Agent 原始字符串 */
  userAgent?: string;
  /** 请求开始时间 */
  startTime: number;
  /** 设备信息（解析自 User-Agent） */
  deviceInfo?: ParsedDeviceInfo;
  /** 地理位置信息 */
  geoLocation?: GeoLocation;
}
