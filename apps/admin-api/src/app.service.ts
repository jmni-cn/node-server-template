import { Injectable } from '@nestjs/common';

/** 根服务：返回服务基础信息。 */
@Injectable()
export class AppService {
  getInfo(): { name: string; status: string; timestamp: string } {
    return {
      name: 'admin-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
