import type { Permission } from '@fintech-demo/contracts';
import { ForbiddenError } from '../errors/index.js';
import { hasPermission } from './actor.js';
import type { Actor } from './actor.js';

export { createActor, hasPermission } from './actor.js';
export type { Actor } from './actor.js';
export { ROLE_PERMISSIONS, permissionsForRole } from './permissions.js';

/** The one permission check every module uses. Throws a consistent 403 when the actor lacks the permission. */
export function requirePermission(actor: Actor, permission: Permission): void {
  if (!hasPermission(actor, permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
}
