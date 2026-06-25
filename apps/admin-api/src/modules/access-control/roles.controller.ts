import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiBaseResponse,
  ApiPaginatedResponse,
  ApiSuccessResponse,
  PageResultVo,
} from '@core/common';
import { Permissions } from '@platform/auth';
import { OperationLogDecorator } from '@platform/audit';
import {
  AssignMenusDto,
  AssignPermissionsDto,
  CreateRoleDto,
  ListRoleDto,
  RoleService,
  RoleVo,
  RoleDetailVo,
  UpdateRoleDto,
} from '@domains/access-control';

/** 管理后台角色管理控制器。 */
@ApiTags('角色管理')
@ApiBearerAuth('bearer')
@Controller('roles')
export class RolesController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @Permissions('rbac:role:read')
  @ApiOperation({ summary: '角色列表（分页）' })
  @ApiPaginatedResponse(RoleVo)
  list(@Query() dto: ListRoleDto): Promise<PageResultVo<RoleVo>> {
    return this.roleService.list(dto);
  }

  @Get(':uid')
  @Permissions('rbac:role:read')
  @ApiOperation({ summary: '角色详情' })
  @ApiBaseResponse(RoleDetailVo)
  detail(@Param('uid') uid: string): Promise<RoleDetailVo> {
    return this.roleService.getDetail(uid);
  }

  @Post()
  @Permissions('rbac:role:create')
  @ApiOperation({ summary: '创建角色' })
  @OperationLogDecorator({ action: 'CREATE_ROLE', module: 'Roles' })
  @ApiBaseResponse(RoleVo)
  create(@Body() dto: CreateRoleDto): Promise<RoleVo> {
    return this.roleService.create(dto);
  }

  @Patch(':uid')
  @Permissions('rbac:role:update')
  @ApiOperation({ summary: '更新角色' })
  @OperationLogDecorator({ action: 'UPDATE_ROLE', module: 'Roles' })
  @ApiBaseResponse(RoleVo)
  update(
    @Param('uid') uid: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleVo> {
    return this.roleService.update(uid, dto);
  }

  @Delete(':uid')
  @Permissions('rbac:role:delete')
  @ApiOperation({ summary: '删除角色' })
  @OperationLogDecorator({ action: 'DELETE_ROLE', module: 'Roles' })
  @ApiSuccessResponse()
  remove(@Param('uid') uid: string): Promise<void> {
    return this.roleService.remove(uid);
  }

  @Post(':uid/permissions')
  @Permissions('rbac:role:assign-permission')
  @ApiOperation({ summary: '分配权限' })
  @OperationLogDecorator({ action: 'ASSIGN_ROLE_PERMISSIONS', module: 'Roles' })
  @ApiSuccessResponse()
  assignPermissions(
    @Param('uid') uid: string,
    @Body() dto: AssignPermissionsDto,
  ): Promise<void> {
    return this.roleService.assignPermissions(uid, dto);
  }

  @Post(':uid/menus')
  @Permissions('rbac:role:assign-menu')
  @ApiOperation({ summary: '分配菜单' })
  @OperationLogDecorator({ action: 'ASSIGN_ROLE_MENUS', module: 'Roles' })
  @ApiSuccessResponse()
  assignMenus(
    @Param('uid') uid: string,
    @Body() dto: AssignMenusDto,
  ): Promise<void> {
    return this.roleService.assignMenus(uid, dto);
  }
}
