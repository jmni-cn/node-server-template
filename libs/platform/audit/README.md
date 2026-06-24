# @platform/audit

操作日志（审计）库。记录带 `@OperationLogDecorator` 标记接口的请求/响应，经队列异步落库。

## 实体

`OperationLog` -> 表 `operation_logs`，`uidPrefix = 'oplog'`（继承自 `@core/database` 的 `BaseEntity`）。

主要列：`actor_id` / `actor_name`（操作者，来自 sub / username）、`action`、`module`、`method`、`path`、`ip`、`user_agent`、`params`(json)、`result`(json)、`status`（`success` / `failed`）、`duration_ms`、`error_code`。另保留 `request_id`、`session_uid`(jti)、设备信息（`device_type`/`browser`/`browser_version`/`os`/`os_version`）、地理位置（`country`/`region`/`city`）、`error_message`。

## 装饰器用法

实体类与装饰器在源文件内同名 `OperationLog`，为避免公开导出冲突，装饰器从根 `index.ts` 重命名导出为 `OperationLogDecorator`。

```typescript
import { OperationLogDecorator } from '@platform/audit';

@Controller('users')
export class UsersController {
  @Post()
  @OperationLogDecorator({ action: 'CREATE_USER', module: 'Users' })
  async create() {}
}
```

## 拦截器与队列

`OperationLogInterceptor` 注入 `Reflector` + `QueueProducer`：读取 `OPERATION_LOG_KEY` 元数据，从 `RequestContextService` 取操作者 / IP / UA / 设备 / 地理位置，构建 `OperationLogJobData` 并入队到 `QUEUE_NAMES.AUDIT`（`'audit'`）/ `JOB_NAMES.AUDIT.WRITE_OPERATION_LOG`（`'write-operation-log'`）。成功 `status='success'`，异常 `status='failed'` 并附带 `errorCode`/`errorMessage` 后重新抛出。入队失败不影响主请求。

worker 侧消费该 job，调用 `OperationLogService.persistFromJob(data)` 落库。

## 查询

`OperationLogQueryService.query(params)` 分页查询（按 module/action/actorId/status + createdAt 区间过滤，createdAt 倒序），`findByUid(uid)` 查询详情（不存在抛 `BusinessException(AuditErrorCode.OP_LOG_NOT_FOUND)`）。
```
