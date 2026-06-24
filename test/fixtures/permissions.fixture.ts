/**
 * Shared permission fixtures (RBAC). Codes follow the `<group>:<resource>:<action>`
 * convention used by @Permissions(...) on admin endpoints (see AUTH-SPEC.md).
 */
export const permissionFixtures = [
  { uid: 'perm_user_read0', code: 'rbac:user:read', name: 'Read users' },
  { uid: 'perm_user_write', code: 'rbac:user:write', name: 'Write users' },
  { uid: 'perm_role_read0', code: 'rbac:role:read', name: 'Read roles' },
  { uid: 'perm_role_write', code: 'rbac:role:write', name: 'Write roles' },
];

/** Convenience: just the permission code strings. */
export const permissionCodes = permissionFixtures.map((p) => p.code);
