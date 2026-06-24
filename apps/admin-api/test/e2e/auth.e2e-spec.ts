import { Test, type TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { adminLoginFixture } from '../fixtures/auth.fixture';

/**
 * admin-api 认证 e2e 冒烟测试。
 *
 * 需要可用的 MySQL / Redis 与种子管理员账户。无依赖环境下用 `describe.skip`
 * 占位，作为接入真实环境后的起点。
 */
describe.skip('Admin Auth (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.setGlobalPrefix('admin');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('POST /admin/auth/login returns tokens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/auth/login',
      payload: adminLoginFixture,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.refreshToken).toBeDefined();
  });

  it('GET /admin/auth/me requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/auth/me' });
    expect(res.statusCode).toBe(401);
  });
});
