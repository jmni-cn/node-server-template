import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiBaseResponse,
  ApiPaginatedResponse,
  PageResultVo,
} from '@core/common';
import { Permissions } from '@platform/auth';
import { OperationLogDecorator } from '@platform/audit';
import {
  EndUserService,
  EndUserVo,
  EndUserDetailVo,
  ListUserDto,
  UpdateUserDto,
} from '@domains/identity';

/**
 * 管理后台「终端用户」管理控制器。
 *
 * 管理的是终端用户（EndUser，end_users 表），用于后台查看/检索/更新（含禁用）
 * 终端用户。管理员账号本身在 `/admin/administrators` 管理。
 *
 * 各端点按操作细分 `rbac:user:*` 权限点；写操作记录操作日志。控制器仅做参数
 * 透传与 VO 返回，业务逻辑在 {@link EndUserService}。
 */
@ApiTags('用户管理')
@ApiBearerAuth('bearer')
@Controller('users')
export class AdminUsersController {
  constructor(private readonly endUserService: EndUserService) {}

  @Get()
  @Permissions('rbac:user:read')
  @ApiOperation({ summary: '终端用户列表（分页）' })
  @ApiPaginatedResponse(EndUserVo)
  list(@Query() dto: ListUserDto): Promise<PageResultVo<EndUserVo>> {
    return this.endUserService.list(dto);
  }

  @Get(':uid')
  @Permissions('rbac:user:read')
  @ApiOperation({ summary: '终端用户详情' })
  @ApiBaseResponse(EndUserDetailVo)
  detail(@Param('uid') uid: string): Promise<EndUserDetailVo> {
    return this.endUserService.getDetail(uid);
  }

  @Patch(':uid')
  @Permissions('rbac:user:update')
  @ApiOperation({ summary: '更新终端用户（含禁用/启用）' })
  @OperationLogDecorator({ action: 'UPDATE_USER', module: 'Users' })
  @ApiBaseResponse(EndUserVo)
  update(
    @Param('uid') uid: string,
    @Body() dto: UpdateUserDto,
  ): Promise<EndUserVo> {
    return this.endUserService.update(uid, dto);
  }
}
