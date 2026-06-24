# @platform/health

基于 [`@nestjs/terminus`](https://github.com/nestjs/terminus) 的聚合健康检查库。

## 提供能力

- `HealthService.check()` —— 聚合 **database + redis + queue** 三项依赖的 readiness 状态，返回 `HealthCheckResult`。
- `HealthService.liveness()` —— 无依赖的存活探针，返回 `{ status: 'ok', timestamp }`。
- 自定义指示器：`DatabaseHealthIndicator` / `RedisHealthIndicator` / `QueueHealthIndicator`。

指示器使用的健康键：`database`、`redis`、`queue`。队列指示器探测的是 BullMQ `SYSTEM` 队列底层连接。

## 使用

本库不提供 controller —— **apps 自行创建 controller**（例如 `GET /health`）并调用 `HealthService`：

```ts
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  check() {
    return this.health.check();
  }

  @Get('live')
  live() {
    return this.health.liveness();
  }
}
```

在 app 根模块中导入 `HealthModule`，并在 controller 所在模块声明上述 controller。

## 依赖前提

`HealthModule` 仅注册 `SYSTEM` 队列用于探测；其余依赖需由 app 全局模块提供：

- **TypeORM**（app 全局，提供 DataSource）—— 供 `DatabaseHealthIndicator` 使用。
- **CacheModule**（全局，提供 `RedisService`）—— 供 `RedisHealthIndicator` 使用。
- **`QueueModule.forRoot()`**（app 根模块，注册 BullMQ 全局连接）—— 供 `QueueHealthIndicator` 使用。
