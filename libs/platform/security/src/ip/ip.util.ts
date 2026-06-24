/**
 * Pure IP address helpers (no NestJS / I/O dependencies).
 */

const IPV4_RE =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
// Permissive IPv6 matcher covering full, compressed and IPv4-mapped forms.
const IPV6_RE = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(%[0-9a-zA-Z]+)?$/;

/**
 * Normalize an IP: trim whitespace and strip the `::ffff:` IPv4-mapped prefix.
 */
export function normalizeIp(ip: string): string {
  const trimmed = (ip ?? '').trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('::ffff:')) {
    return trimmed.slice('::ffff:'.length);
  }
  return trimmed;
}

/**
 * Basic IPv4 / IPv6 validity check.
 */
export function isValidIp(ip: string): boolean {
  const normalized = normalizeIp(ip);
  if (!normalized) {
    return false;
  }
  return IPV4_RE.test(normalized) || IPV6_RE.test(normalized);
}

/**
 * Extract the client IP from request headers.
 * Order: first hop of `x-forwarded-for`, then `x-real-ip`, then fallback.
 */
export function extractClientIp(
  headers: Record<string, string | string[] | undefined>,
  fallback?: string,
): string | null {
  const forwarded = headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (forwardedValue) {
    const firstHop = forwardedValue.split(',')[0]?.trim();
    if (firstHop) {
      return normalizeIp(firstHop);
    }
  }

  const realIp = headers['x-real-ip'];
  const realIpValue = Array.isArray(realIp) ? realIp[0] : realIp;
  if (realIpValue) {
    return normalizeIp(realIpValue);
  }

  return fallback ? normalizeIp(fallback) : null;
}
