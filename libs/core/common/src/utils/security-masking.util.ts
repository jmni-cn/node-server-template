import * as crypto from 'crypto';

/** 脱敏 IP：保留前三段 IPv4，末段替换为 ***；IPv6 保留前三组 */
export function maskIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const trimmed = ip.trim();
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
  }
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length > 2) {
      return `${parts.slice(0, 3).join(':')}:****`;
    }
  }
  return '***';
}

/** User-Agent SHA256 截断（16 hex chars） */
export function hashUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  return crypto.createHash('sha256').update(ua).digest('hex').substring(0, 16);
}
