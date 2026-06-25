import { Test, type TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { registerFixture } from '../fixtures/auth.fixture';

/**
 * user-api 认证 e2e 冒烟测试（需 MySQL / Redis）。无依赖时跳过。
 */
describe.skip('User Auth (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('POST /auth/register returns tokens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: registerFixture,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{
      success: boolean;
      data: { accessToken?: string };
    }>();
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeDefined();
  });

  it('GET /users/me requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/users/me' });
    expect(res.statusCode).toBe(401);
  });
});
