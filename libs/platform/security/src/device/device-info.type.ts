/**
 * Normalized device / client information derived from a User-Agent and IP.
 */
export interface DeviceInfo {
  ip: string | null;
  userAgent: string | null;
  deviceType: string;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
}
