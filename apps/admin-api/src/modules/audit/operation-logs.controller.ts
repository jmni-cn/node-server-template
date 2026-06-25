import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiBaseResponse,
  ApiPaginatedResponse,
  PageResultVo,
} from '@core/common';
import { Permissions } from '@platform/auth';
import {
  OperationLogQueryService,
  QueryOperationLogDto,
  OperationLogDetailVo,
  OperationLogListItemVo,
} from '@platform/audit';

/** 管理后台操作日志（审计）查询控制器。只读，无写操作。 */
@ApiTags('操作日志')
@ApiBearerAuth('bearer')
@Permissions('audit:log:read')
@Controller('operation-logs')
export class OperationLogsController {
  constructor(private readonly queryService: OperationLogQueryService) {}

  @Get()
  @ApiOperation({ summary: '操作日志列表（分页）' })
  @ApiPaginatedResponse(OperationLogListItemVo)
  list(
    @Query() dto: QueryOperationLogDto,
  ): Promise<PageResultVo<OperationLogListItemVo>> {
    return this.queryService.query(dto.toQueryParams());
  }

  @Get(':uid')
  @ApiOperation({ summary: '操作日志详情' })
  @ApiBaseResponse(OperationLogDetailVo)
  detail(@Param('uid') uid: string): Promise<OperationLogDetailVo> {
    return this.queryService.findByUid(uid);
  }
}
