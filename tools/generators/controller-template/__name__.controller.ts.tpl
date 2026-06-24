import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponse } from '@core/common';

/**
 * __Name__ 控制器（单文件生成模板）。
 *
 * 规则：控制器不含业务逻辑、不访问 repository、不返回实体；只编排 service 与 VO。
 */
@ApiTags('__Name__')
@ApiBearerAuth('bearer')
@Controller('__name__')
export class __Name__Controller {
  constructor() {}

  @Get(':uid')
  @ApiOperation({ summary: '获取 __Name__ 详情' })
  @ApiSuccessResponse()
  detail(@Param('uid') uid: string): Promise<void> {
    // TODO: 调用 __name__Service.detail(uid)，返回 VO。
    void uid;
    return Promise.resolve();
  }
}
