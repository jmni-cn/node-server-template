import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';

import { LoggerService } from '@core/logger';
import { AppModule } from './app.module';
import {
  setupApp,
  setupGlobalFilters,
  setupGlobalInterceptors,
  setupGlobalPipes,
  setupSwagger,
} from './bootstrap';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { rawBody: true },
  );

  const config = app.get(ConfigService);
  const logger = await app.resolve(LoggerService);
  logger.setContext('Bootstrap');

  await app.register(fastifyCookie);
  await app.register(fastifyHelmet, { contentSecurityPolicy: false });

  const corsEnabled =
    (config.get<string>('CORS_ENABLED') ?? 'true') !== 'false';
  if (corsEnabled) {
    const origins = config.get<string>('CORS_ORIGIN');
    await app.register(fastifyCors, {
      origin: origins ? origins.split(',').map((o) => o.trim()) : true,
      credentials: true,
    });
  }

  setupApp(app);
  setupGlobalPipes(app);
  await setupGlobalInterceptors(app);
  await setupGlobalFilters(app);
  setupSwagger(app);

  const port = Number(config.get<string>('USER_API_PORT') ?? 3002);
  await app.listen(port, '0.0.0.0');

  logger.log(`User API listening on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('User API bootstrap failed:', err);
  process.exit(1);
});
