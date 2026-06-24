/**
 * Shared role fixtures (RBAC). Mirrors @domains/access-control Role shape.
 * `permissionCodes` reference entries in permissions.fixture.ts.
 */
export const superAdminRoleFixture = {
  uid: 'role_superadmin',
  code: 'SUPER_ADMIN',
  name: 'Super Admin',
  // SUPER_ADMIN is granted everything; the access checker may short-circuit.
  permissionCodes: [
    'rbac:user:read',
    'rbac:user:write',
    'rbac:role:read',
    'rbac:role:write',
  ],
};

export const auditorRoleFixture = {
  uid: 'role_auditor00',
  code: 'AUDITOR',
  name: 'Auditor',
  permissionCodes: ['rbac:user:read', 'rbac:role:read'],
};

export const roleFixtures = [superAdminRoleFixture, auditorRoleFixture];
