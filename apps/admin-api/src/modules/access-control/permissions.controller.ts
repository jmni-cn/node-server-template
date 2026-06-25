import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiArrayResponse,
  ApiBaseResponse,
  ApiPaginatedResponse,
  PageResultVo,
} from '@core/common';
import { Permissions } from '@platform/auth';
import { OperationLogDecorator } from '@platform/audit';
import {
  CreatePermissionDto,
  ListPermissionDto,
  PermissionGroupVo,
  PermissionService,
  PermissionVo,
  UpdatePermissionDto,
} from '@domains/access-control';

/** 管理后台权限管理控制器。 */
@ApiTags('权限管理')
@ApiBearerAuth('bearer')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @Permissions('rbac:permission:read')
  @ApiOperation({ summary: '权限列表（分页）' })
  @ApiPaginatedResponse(PermissionVo)
  list(@Query() dto: ListPermissionDto): Promise<PageResultVo<PermissionVo>> {
    return this.permissionService.list(dto);
  }

  @Get('tree')
  @Permissions('rbac:permission:read')
  @ApiOperation({ summary: '权限分组树' })
  @ApiArrayResponse(PermissionGroupVo)
  tree(): Promise<PermissionGroupVo[]> {
    return this.permissionService.groupTree();
  }

  @Post()
  @Permissions('rbac:permission:create')
  @ApiOperation({ summary: '创建权限' })
  @OperationLogDecorator({ action: 'CREATE_PERMISSION', module: 'Permissions' })
  @ApiBaseResponse(PermissionVo)
  create(@Body() dto: CreatePermissionDto): Promise<PermissionVo> {
    return this.permissionService.create(dto);
  }

  @Patch(':uid')
  @Permissions('rbac:permission:update')
  @ApiOperation({ summary: '更新权限' })
  @OperationLogDecorator({ action: 'UPDATE_PERMISSION', module: 'Permissions' })
  @ApiBaseResponse(PermissionVo)
  update(
    @Param('uid') uid: string,
    @Body() dto: UpdatePermissionDto,
  ): Promise<PermissionVo> {
    return this.permissionService.update(uid, dto);
  }
}
