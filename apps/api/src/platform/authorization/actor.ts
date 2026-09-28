import type { Permission, Role } from '@fintech-demo/contracts';
import { permissionsForRole } from './permissions.js';

/** The authenticated principal, resolved server-side from the session. */
export interface Actor {
  id: string;
  displayName: string;
  role: Role;
  permissions: readonly Permission[];
}

export function createActor(user: { id: string; displayName: string; role: Role }): Actor {
  return {
    id: user.id,
    displayName: user.displayName,
    role: user.role,
    permissions: permissionsForRole(user.role),
  };
}

export function hasPermission(actor: Actor, permission: Permission): boolean {
  return actor.permissions.includes(permission);
}
