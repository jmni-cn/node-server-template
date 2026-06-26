/**
 * 地理位置解析工具：基于 geoip-lite 将客户端 IP 解析为 国家/地区/城市。
 *
 * 设计原则：
 * - geoip-lite 为可选依赖：若未安装（或加载失败），优雅降级返回全 null，
 *   不影响请求主链路；
 * - 解析失败、内网/保留 IP 同样返回全 null；
 * - 保持本 lib 零 @core 依赖（不引入 @core/common 等）。
 */
import type { GeoLocation } from './request-context.types';

/** geoip-lite lookup 返回结构的最小形状。 */
interface GeoipLookupResult {
  country?: string;
  region?: string;
  city?: string;
}

interface GeoipModule {
  lookup(ip: string): GeoipLookupResult | null;
}

/** 空地理位置（解析失败 / 未安装 geoip-lite 时返回）。 */
const EMPTY_GEO: GeoLocation = { country: null, region: null, city: null };

/**
 * 延迟加载 geoip-lite，仅加载一次。
 * 未安装时缓存为 null，后续不再重复尝试。
 */
let geoipModule: GeoipModule | null | undefined;

function loadGeoip(): GeoipModule | null {
  if (geoipModule !== undefined) {
    return geoipModule;
  }
  try {
    // 使用 eval('require') 以避免打包器在缺失可选依赖时静态报错。
    const req = eval('require') as NodeRequire;
    geoipModule = req('geoip-lite') as GeoipModule;
  } catch {
    geoipModule = null;
  }
  return geoipModule;
}

/**
 * 将 IP 解析为地理位置。
 *
 * @param ip 客户端 IP（可能为 null/undefined）
 * @returns GeoLocation；无法解析时各字段为 null
 */
export function resolveGeoLocation(ip: string | null | undefined): GeoLocation {
  if (!ip) return EMPTY_GEO;

  const geoip = loadGeoip();
  if (!geoip) return EMPTY_GEO;

  try {
    const result = geoip.lookup(ip.trim());
    if (!result) return EMPTY_GEO;
    return {
      country: result.country || null,
      region: result.region || null,
      city: result.city || null,
    };
  } catch {
    return EMPTY_GEO;
  }
}
