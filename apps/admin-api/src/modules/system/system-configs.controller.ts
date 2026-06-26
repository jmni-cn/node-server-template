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
  ConfigDefinitionVo,
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

  @Get('definitions')
  @Permissions('sys:config:read')
  @ApiOperation({
    summary: '配置定义目录（键/默认/来源/业务含义）',
    description:
      '聚合各 lib 注册的运行期配置定义，并叠加当前生效值与来源（db/env/code_default）。机密项当前值已脱敏。',
  })
  @ApiArrayResponse(ConfigDefinitionVo)
  definitions(): Promise<ConfigDefinitionVo[]> {
    return this.systemConfigService.getDefinitions();
  }

  @Get('group/:group')
  @Permissions('sys:config:read')
  @ApiOperation({ summary: '按分组取配置' })
  @ApiArrayResponse(SystemConfigVo)
  byGroup(@Param('group') group: string): Promise<SystemConfigVo[]> {
    return this.systemConfigService.getByGroup(group);
  }

  @Get(':key')
  @Permissions('sys:config:read')
  @ApiOperation({ summary: '配置详情（按 key；机密项 value 已脱敏）' })
  @ApiBaseResponse(SystemConfigVo)
  detail(@Param('key') key: string): Promise<SystemConfigVo> {
    return this.systemConfigService.getVo(key);
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
