/**
 * Auth test helper — mints JWTs for tests without going through the login flow.
 *
 * Signs tokens with the same secrets the app reads (JWT_SECRET /
 * JWT_REFRESH_SECRET from env, defaulted in jest.setup.ts), so a token created
 * here passes the admin-jwt / user-jwt strategies. See AUTH-SPEC.md for the
 * payload shape (sub = user uid).
 */
import { JwtService } from '@nestjs/jwt';

export interface TestPrincipal {
  /** User UID (token subject). */
  sub: string;
  /** Login identifier (username/email). */
  username?: string;
  /** Granted permission codes (admin principals). */
  permissions?: string[];
  /** Token audience: which API the principal belongs to. */
  audience?: 'admin' | 'user';
}

const accessJwt = new JwtService({
  secret: process.env.JWT_SECRET ?? 'test-access-secret',
});
const refreshJwt = new JwtService({
  secret: process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret',
});

/** Create a signed access token for a test principal. */
export function createAccessToken(principal: TestPrincipal): string {
  const { sub, username, permissions, audience = 'admin' } = principal;
  return accessJwt.sign(
    { sub, username, permissions, aud: audience, typ: 'access' },
    { expiresIn: '15m' },
  );
}

/** Create a signed refresh token for a test principal. */
export function createRefreshToken(principal: TestPrincipal): string {
  const { sub, audience = 'admin' } = principal;
  return refreshJwt.sign(
    { sub, aud: audience, typ: 'refresh' },
    { expiresIn: '7d' },
  );
}

/** Build an `Authorization: Bearer ...` header for inject()/supertest. */
export function bearer(principal: TestPrincipal): Record<string, string> {
  return { authorization: `Bearer ${createAccessToken(principal)}` };
}
