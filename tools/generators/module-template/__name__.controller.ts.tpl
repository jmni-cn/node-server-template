import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponse } from '@core/common';

/**
 * __Name__ 控制器。
 *
 * 控制器只做参数解析与 VO 编排：不含业务逻辑、不访问 repository、不返回实体。
 * 业务逻辑下沉至 domain/platform service，并通过 lib barrel 注入。
 */
@ApiTags('__Name__')
@ApiBearerAuth('bearer')
@Controller('__name__')
export class __Name__Controller {
  constructor() {}

  @Get()
  @ApiOperation({ summary: '__Name__ 列表' })
  @ApiSuccessResponse()
  list(): Promise<void> {
    // TODO: 调用 __name__Service，返回 VO。
    return Promise.resolve();
  }
}
