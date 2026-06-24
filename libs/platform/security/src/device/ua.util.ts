/**
 * 轻量 User-Agent 字符串解析工具（纯函数）。
 *
 * 用于无需完整 ua-parser-js 解析、仅需快速派生设备名 / 平台类型的场景；
 * 需要规范化 {@link DeviceInfo} 时仍应使用 `DeviceInfoService`。
 */

/**
 * 从 User-Agent 提取人类可读的设备名称。
 *
 * @param userAgent 原始 UA 字符串
 * @returns 设备名称，未知时返回 'Unknown Device'
 */
export function extractDeviceName(userAgent?: string): string {
  if (!userAgent) return 'Unknown Device';

  if (userAgent.includes('iPhone')) return 'iPhone';
  if (userAgent.includes('iPad')) return 'iPad';
  if (userAgent.includes('Android')) return 'Android Device';
  if (userAgent.includes('Windows')) return 'Windows PC';
  if (userAgent.includes('Mac')) return 'Mac';
  if (userAgent.includes('Linux')) return 'Linux PC';

  return 'Unknown Device';
}

/**
 * 从 User-Agent 提取平台类型。
 *
 * @param userAgent 原始 UA 字符串
 * @returns 'mobile' | 'tablet' | 'desktop' | 'web' | 'unknown'
 */
export function extractPlatform(userAgent?: string): string {
  if (!userAgent) return 'unknown';

  if (userAgent.includes('Mobile')) return 'mobile';
  if (userAgent.includes('Tablet')) return 'tablet';
  if (
    userAgent.includes('Windows') ||
    userAgent.includes('Mac') ||
    userAgent.includes('Linux')
  ) {
    return 'desktop';
  }

  return 'web';
}
