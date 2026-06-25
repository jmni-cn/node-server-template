import { Injectable, CanActivate } from '@nestjs/common';
import { BusinessException } from '@core/common';
import { RequestContextService } from '@core/request-context';
import { SecurityErrorCode } from '../constants/security-error-codes';
import { IpBlacklistService } from './ip-blacklist.service';

/**
 * IP blacklist guard.
 *
 * Reads the client IP from {@link RequestContextService} (resolved in
 * middleware) to avoid duplicate parsing or forged-header bypass.
 */
@Injectable()
export class IpBlacklistGuard implements CanActivate {
  constructor(private readonly ipBlacklistService: IpBlacklistService) {}

  async canActivate(): Promise<boolean> {
    const ip = RequestContextService.getIp() ?? '';

    if (ip && (await this.ipBlacklistService.isBlocked(ip))) {
      throw new BusinessException(SecurityErrorCode.IP_BLACKLISTED);
    }

    return true;
  }
}
