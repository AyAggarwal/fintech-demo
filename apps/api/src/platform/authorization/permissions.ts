import type { Permission, Role } from '@fintech-demo/contracts';

const READ_ALL: readonly Permission[] = ['refunds:read', 'kyc:read', 'feature-flags:read', 'audit:read'];

/** Single source of truth for what each role may do. Roles come from the seeded user, never from the request. */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  VIEWER: READ_ALL,
  OPS_ANALYST: [...READ_ALL, 'refunds:decide', 'kyc:decide'],
  ADMIN: [...READ_ALL, 'refunds:decide', 'kyc:decide', 'feature-flags:write'],
};

export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
