import type { INestApplicationContext } from '@nestjs/common';
import { LoggerService } from '@core/logger';

/**
 * worker 进程装配：日志启动横幅 + 优雅停机信号处理。
 *
 * worker 无公开 HTTP 服务（可选健康探针由独立 Fastify 实例承担），主要消费
 * BullMQ 队列并执行 cron 调度。
 */
export async function setupWorker(app: INestApplicationContext): Promise<void> {
  const logger = await app.resolve(LoggerService);
  logger.setContext('Worker');

  const concurrency = process.env.WORKER_CONCURRENCY ?? '5';
  const scheduleEnabled =
    (process.env.WORKER_ENABLE_SCHEDULE ?? 'true') !== 'false';

  logger.log(
    `Worker started (concurrency=${concurrency}, schedule=${scheduleEnabled})`,
  );

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`Received ${signal}, shutting down worker...`);
    try {
      await app.close();
    } catch (err) {
      logger.error(`Error during shutdown: ${(err as Error).message}`);
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
