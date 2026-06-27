import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
  CreateTaskDto,
  QueryTaskDto,
  TaskService,
  TaskQueryService,
  TaskAssembler,
  TaskMapper,
  TaskVo,
  TaskListItemVo,
} from '@platform/task';

/** 管理后台任务管理控制器。 */
@ApiTags('任务管理')
@ApiBearerAuth('bearer')
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly taskService: TaskService,
    private readonly taskQueryService: TaskQueryService,
    private readonly taskAssembler: TaskAssembler,
  ) {}

  @Get()
  @Permissions('task:read')
  @ApiOperation({ summary: '任务列表（分页，多维过滤）' })
  @ApiPaginatedResponse(TaskListItemVo)
  async list(
    @Query() dto: QueryTaskDto,
  ): Promise<PageResultVo<TaskListItemVo>> {
    const params = dto.toListParams();
    const [tasks, total] = await this.taskService.listTasks(params);
    return this.taskAssembler.toPageResult(
      tasks,
      total,
      params.page ?? 1,
      params.pageSize ?? 20,
    );
  }

  @Get(':uid')
  @Permissions('task:read')
  @ApiOperation({ summary: '任务详情' })
  @ApiBaseResponse(TaskVo)
  async detail(@Param('uid') uid: string): Promise<TaskVo> {
    const task = await this.taskService.getByUid(uid);
    return TaskMapper.toVo(task);
  }

  @Get(':uid/logs')
  @Permissions('task:read')
  @ApiOperation({ summary: '任务执行日志' })
  @ApiArrayResponse(Object)
  getLogs(@Param('uid') uid: string): Promise<unknown[]> {
    return this.taskQueryService.getLogs(uid);
  }

  @Post(':uid/retry')
  @Permissions('task:retry')
  @ApiOperation({ summary: '重试失败任务' })
  @OperationLogDecorator({ action: 'RETRY_TASK', module: 'Tasks' })
  @ApiBaseResponse(TaskVo)
  async retry(@Param('uid') uid: string): Promise<TaskVo> {
    const task = await this.taskService.retryTask(uid);
    return TaskMapper.toVo(task);
  }

  @Post(':uid/cancel')
  @Permissions('task:cancel')
  @ApiOperation({ summary: '取消任务' })
  @OperationLogDecorator({ action: 'CANCEL_TASK', module: 'Tasks' })
  @ApiBaseResponse(TaskVo)
  async cancel(@Param('uid') uid: string): Promise<TaskVo> {
    const task = await this.taskService.cancelTask(uid);
    return TaskMapper.toVo(task);
  }

  @Post('trigger')
  @Permissions('task:trigger')
  @ApiOperation({ summary: '手动触发任务（创建并入队）' })
  @OperationLogDecorator({ action: 'TRIGGER_TASK', module: 'Tasks' })
  @ApiBaseResponse(TaskVo)
  async trigger(@Body() dto: CreateTaskDto): Promise<TaskVo> {
    const task = await this.taskService.createAndEnqueue(dto.toCreateInput());
    return TaskMapper.toVo(task);
  }
}
