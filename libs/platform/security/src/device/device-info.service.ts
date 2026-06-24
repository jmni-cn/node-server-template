import { Injectable } from '@nestjs/common';
import { UAParser } from 'ua-parser-js';
import { RequestContextService } from '@core/request-context';
import type { DeviceInfo } from './device-info.type';

type NormalizedDeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';

/**
 * Parses User-Agent strings into normalized {@link DeviceInfo}.
 */
@Injectable()
export class DeviceInfoService {
  /**
   * Parse the given User-Agent / IP into a {@link DeviceInfo}.
   */
  parse(userAgent?: string | null, ip?: string | null): DeviceInfo {
    const ua = userAgent ?? null;
    const result = new UAParser(ua ?? undefined).getResult();

    const browserType = (result.browser as { type?: string }).type;

    return {
      ip: ip ?? null,
      userAgent: ua,
      deviceType: this.normalizeDeviceType(result.device.type, browserType),
      browser: result.browser.name ?? null,
      browserVersion: result.browser.version ?? null,
      os: result.os.name ?? null,
      osVersion: result.os.version ?? null,
    };
  }

  /**
   * Build {@link DeviceInfo} from the current request context (static getters).
   */
  fromContext(): DeviceInfo {
    return this.parse(
      RequestContextService.getUserAgent() ?? null,
      RequestContextService.getIp() ?? null,
    );
  }

  private normalizeDeviceType(
    type?: string,
    browserType?: string,
  ): NormalizedDeviceType {
    if (browserType === 'bot' || browserType === 'crawler') {
      return 'bot';
    }
    switch (type) {
      case 'mobile':
        return 'mobile';
      case 'tablet':
        return 'tablet';
      case 'console':
      case 'smarttv':
      case 'wearable':
      case 'embedded':
        return 'unknown';
      default:
        // ua-parser-js leaves device.type undefined for desktops.
        return type ? 'unknown' : 'desktop';
    }
  }
}
