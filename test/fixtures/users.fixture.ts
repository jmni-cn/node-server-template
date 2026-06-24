/**
 * Shared user fixtures for tests. Plain data only — no DB/DI coupling.
 * Mirrors the @domains/identity User shape (uid prefixed, see BaseEntity).
 */
export const adminUserFixture = {
  uid: 'usr_admin0001',
  username: 'admin',
  email: 'admin@example.com',
  // bcrypt-able plaintext used by login fixtures; never a real credential.
  password: 'admin123456',
  status: 'ACTIVE',
};

export const regularUserFixture = {
  uid: 'usr_user00001',
  username: 'alice',
  email: 'alice@example.com',
  password: 'alice123456',
  status: 'ACTIVE',
};

export const disabledUserFixture = {
  uid: 'usr_user00002',
  username: 'bob',
  email: 'bob@example.com',
  password: 'bob1234567',
  status: 'DISABLED',
};

export const userFixtures = [
  adminUserFixture,
  regularUserFixture,
  disabledUserFixture,
];
