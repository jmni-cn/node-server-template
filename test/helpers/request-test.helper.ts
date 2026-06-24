/**
 * Request test helper — boots a Fastify Nest app for e2e tests and wraps
 * supertest so specs read cleanly.
 *
 * Because the app runs on Fastify, the underlying HTTP server must be ready
 * before supertest hits it; `createTestApp` handles `app.init()` +
 * `getHttpAdapter().getInstance().ready()`.
 */
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, type Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import supertest from 'supertest';

export interface CreateTestAppOptions {
  /** Global route prefix (admin-api uses 'admin'; user-api uses none). */
  globalPrefix?: string;
  /** Override providers, e.g. swap a service for a mock. */
  overrides?: Array<{ provide: unknown; useValue: unknown }>;
}

/** Compile the given root module into a ready-to-test Fastify Nest app. */
export async function createTestApp(
  rootModule: Type<unknown>,
  options: CreateTestAppOptions = {},
): Promise<NestFastifyApplication> {
  const builder = Test.createTestingModule({ imports: [rootModule] });

  for (const o of options.overrides ?? []) {
    builder.overrideProvider(o.provide).useValue(o.useValue);
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );

  if (options.globalPrefix) {
    app.setGlobalPrefix(options.globalPrefix);
  }
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

/** supertest agent bound to the running Fastify server. */
export function http(
  app: NestFastifyApplication,
): ReturnType<typeof supertest> {
  return supertest(app.getHttpServer());
}
