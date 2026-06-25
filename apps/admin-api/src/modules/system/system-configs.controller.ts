import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiArrayResponse,
  ApiBaseResponse,
  ApiPaginatedResponse,
  ApiSuccessResponse,
  PageResultVo,
} from '@core/common';
import { Permissions } from '@platform/auth';
import { OperationLogDecorator } from '@platform/audit';
import {
  QueryConfigDto,
  SetConfigDto,
  SystemConfigService,
  SystemConfigVo,
} from '@domains/system';

/** 管理后台系统配置控制器。 */
@ApiTags('系统配置')
@ApiBearerAuth('bearer')
@Controller('system-configs')
export class SystemConfigsController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  @Permissions('sys:config:read')
  @ApiOperation({ summary: '系统配置列表（分页）' })
  @ApiPaginatedResponse(SystemConfigVo)
  list(@Query() dto: QueryConfigDto): Promise<PageResultVo<SystemConfigVo>> {
    return this.systemConfigService.list(dto);
  }

  @Get('group/:group')
  @Permissions('sys:config:read')
  @ApiOperation({ summary: '按分组取配置' })
  @ApiArrayResponse(SystemConfigVo)
  byGroup(@Param('group') group: string): Promise<SystemConfigVo[]> {
    return this.systemConfigService.getByGroup(group);
  }

  @Post()
  @Permissions('sys:config:update')
  @ApiOperation({ summary: '设置（创建/更新）配置' })
  @OperationLogDecorator({ action: 'SET_CONFIG', module: 'SystemConfigs' })
  @ApiBaseResponse(SystemConfigVo)
  set(@Body() dto: SetConfigDto): Promise<SystemConfigVo> {
    return this.systemConfigService.set(dto);
  }

  @Delete(':key')
  @Permissions('sys:config:delete')
  @ApiOperation({ summary: '删除配置' })
  @OperationLogDecorator({ action: 'DELETE_CONFIG', module: 'SystemConfigs' })
  @ApiSuccessResponse()
  remove(@Param('key') key: string): Promise<void> {
    return this.systemConfigService.delete(key);
  }
}
