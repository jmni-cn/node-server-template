import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@platform/auth';
import { AppService } from './app.service';

/** 根控制器：提供服务信息探针（公开）。 */
@ApiTags('健康检查')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '服务信息' })
  getInfo(): { name: string; status: string; timestamp: string } {
    return this.appService.getInfo();
  }
}
