/**
 * @platform/health — 基于 @nestjs/terminus 的聚合健康检查。
 *
 * 提供 HealthModule、HealthService（聚合 database/redis/queue）与各自定义指示器。
 * apps 负责创建 controller 并调用 HealthService.check() / liveness()。
 */
export * from './indicators';
export * from './health.service';
export * from './health.module';
