import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiArrayResponse,
  ApiBaseResponse,
  ApiSuccessResponse,
} from '@core/common';
import { Permissions } from '@platform/auth';
import { OperationLogDecorator } from '@platform/audit';
import {
  CreateMenuDto,
  MenuService,
  MenuVo,
  MenuTreeVo,
  UpdateMenuDto,
} from '@domains/access-control';

/** 管理后台菜单管理控制器。 */
@ApiTags('菜单管理')
@ApiBearerAuth('bearer')
@Controller('menus')
export class MenusController {
  constructor(private readonly menuService: MenuService) {}

  @Get('tree')
  @Permissions('rbac:menu:read')
  @ApiOperation({ summary: '菜单树' })
  @ApiArrayResponse(MenuTreeVo)
  tree(): Promise<MenuTreeVo[]> {
    return this.menuService.tree();
  }

  @Post()
  @Permissions('rbac:menu:create')
  @ApiOperation({ summary: '创建菜单' })
  @OperationLogDecorator({ action: 'CREATE_MENU', module: 'Menus' })
  @ApiBaseResponse(MenuVo)
  create(@Body() dto: CreateMenuDto): Promise<MenuVo> {
    return this.menuService.create(dto);
  }

  @Patch(':uid')
  @Permissions('rbac:menu:update')
  @ApiOperation({ summary: '更新菜单' })
  @OperationLogDecorator({ action: 'UPDATE_MENU', module: 'Menus' })
  @ApiBaseResponse(MenuVo)
  update(
    @Param('uid') uid: string,
    @Body() dto: UpdateMenuDto,
  ): Promise<MenuVo> {
    return this.menuService.update(uid, dto);
  }

  @Delete(':uid')
  @Permissions('rbac:menu:delete')
  @ApiOperation({ summary: '删除菜单' })
  @OperationLogDecorator({ action: 'DELETE_MENU', module: 'Menus' })
  @ApiSuccessResponse()
  remove(@Param('uid') uid: string): Promise<void> {
    return this.menuService.remove(uid);
  }
}
