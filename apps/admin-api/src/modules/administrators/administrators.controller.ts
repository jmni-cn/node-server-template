import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiBaseResponse,
  ApiPaginatedResponse,
  ApiSuccessResponse,
  PageResultVo,
  PaginationDto,
} from '@core/common';
import { Permissions } from '@platform/auth';
import { OperationLogDecorator } from '@platform/audit';
import { AdminUserVo } from '@domains/identity';

import {
  AssignAdministratorRolesDto,
  CreateAdministratorDto,
  ResetAdministratorPasswordDto,
  UpdateAdministratorDto,
} from './dto';
import { AdministratorDetailVo } from './vo';
import { AdministratorsService } from './administrators.service';

/**
 * 管理员账号管理控制器（`/admin/administrators`）。
 *
 * 管理的是「管理员账号」（AdminUser / admin_users 表），与终端用户管理
 * （`/admin/users`）严格分离。全部端点要求 `rbac:admin:*` 权限；写操作记录操作日志。
 * 控制器保持轻薄：跨服务编排在 {@link AdministratorsService}。
 */
@ApiTags('管理员管理')
@ApiBearerAuth('bearer')
@Permissions('rbac:admin:*')
@Controller('administrators')
export class AdministratorsController {
  constructor(private readonly administratorsService: AdministratorsService) {}

  @Get()
  @ApiOperation({ summary: '管理员列表（分页）' })
  @ApiPaginatedResponse(AdminUserVo)
  list(@Query() dto: PaginationDto): Promise<PageResultVo<AdminUserVo>> {
    return this.administratorsService.list(dto);
  }

  @Get(':uid')
  @ApiOperation({ summary: '管理员详情（含角色）' })
  @ApiBaseResponse(AdministratorDetailVo)
  detail(@Param('uid') uid: string): Promise<AdministratorDetailVo> {
    return this.administratorsService.detail(uid);
  }

  @Post()
  @ApiOperation({ summary: '创建管理员' })
  @OperationLogDecorator({ action: 'CREATE_ADMIN', module: 'Administrators' })
  @ApiBaseResponse(AdminUserVo)
  create(@Body() dto: CreateAdministratorDto): Promise<AdminUserVo> {
    return this.administratorsService.create(dto);
  }

  @Patch(':uid')
  @ApiOperation({ summary: '更新管理员（含禁用/启用）' })
  @OperationLogDecorator({ action: 'UPDATE_ADMIN', module: 'Administrators' })
  @ApiBaseResponse(AdminUserVo)
  update(
    @Param('uid') uid: string,
    @Body() dto: UpdateAdministratorDto,
  ): Promise<AdminUserVo> {
    return this.administratorsService.update(uid, dto);
  }

  @Put(':uid/roles')
  @ApiOperation({ summary: '分配管理员角色（全量替换）' })
  @OperationLogDecorator({
    action: 'ASSIGN_ADMIN_ROLES',
    module: 'Administrators',
  })
  @ApiSuccessResponse()
  assignRoles(
    @Param('uid') uid: string,
    @Body() dto: AssignAdministratorRolesDto,
  ): Promise<void> {
    return this.administratorsService.assignRoles(uid, dto.roleUids);
  }

  @Put(':uid/password')
  @ApiOperation({ summary: '重置管理员密码（吊销其全部会话）' })
  @OperationLogDecorator({
    action: 'RESET_ADMIN_PASSWORD',
    module: 'Administrators',
  })
  @ApiSuccessResponse()
  resetPassword(
    @Param('uid') uid: string,
    @Body() dto: ResetAdministratorPasswordDto,
  ): Promise<void> {
    return this.administratorsService.resetPassword(uid, dto.newPassword);
  }
}
