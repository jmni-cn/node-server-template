import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupWorker } from './bootstrap';

/**
 * worker 进程入口。
 *
 * 使用 `createApplicationContext`（无 HTTP 服务器），由 BullMQ processors 消费
 * 队列、`@nestjs/schedule` 执行 cron。可选的健康探针由 WORKER_HEALTH_PORT 控制
 * （见 README，本模板默认不启用以保持进程最小化）。
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  await setupWorker(app);
}

bootstrap().catch((err) => {
  console.error('Worker bootstrap failed:', err);
  process.exit(1);
});
