import type { FeatureFlag, FeatureFlagUpdateRequest, FeatureFlagUpdateResponse } from '@fintech-demo/contracts';
import { requirePermission } from '../../platform/authorization/index.js';
import type { Actor } from '../../platform/authorization/index.js';
import type { DatabaseClient } from '../../platform/database/index.js';
import { ConflictError, NotFoundError } from '../../platform/errors/index.js';
import { executePrivilegedAction } from '../../platform/policies/index.js';
import { applyFeatureFlagChange, findFeatureFlag, listFeatureFlags } from './feature-flag-repository.js';

export interface FeatureFlagService {
  list(actor: Actor): Promise<FeatureFlag[]>;
  update(actor: Actor, id: string, request: FeatureFlagUpdateRequest): Promise<FeatureFlagUpdateResponse>;
}

export interface FeatureFlagServiceDependencies {
  db: DatabaseClient;
}

function flagSnapshot(flag: FeatureFlag): Record<string, string | boolean | null> {
  return { key: flag.key, enabled: flag.enabled, updatedByName: flag.updatedByName };
}

export function createFeatureFlagService({ db }: FeatureFlagServiceDependencies): FeatureFlagService {
  return {
    async list(actor) {
      requirePermission(actor, 'feature-flags:read');
      return listFeatureFlags(db);
    },

    async update(actor, id, request) {
      const outcome = await executePrivilegedAction(db, {
        actor,
        permission: 'feature-flags:write',
        action: request.enabled ? 'feature_flag.enabled' : 'feature_flag.disabled',
        entityType: 'FEATURE_FLAG',
        input: request,
        apply: async (tx) => {
          const before = await findFeatureFlag(tx, id);
          if (!before) {
            throw new NotFoundError('Feature flag', id);
          }
          if (before.enabled === request.enabled) {
            throw new ConflictError(`Feature flag ${before.key} is already ${request.enabled ? 'enabled' : 'disabled'}`);
          }
          const changed = await applyFeatureFlagChange(tx, { id, enabled: request.enabled, actorId: actor.id });
          if (changed !== 1) {
            throw new ConflictError(`Feature flag ${before.key} was changed by another request`);
          }
          const after = await findFeatureFlag(tx, id);
          if (!after) {
            throw new NotFoundError('Feature flag', id);
          }
          return {
            entityId: after.id,
            entityLabel: after.key,
            before: flagSnapshot(before),
            after: flagSnapshot(after),
            result: after,
          };
        },
      });
      return { flag: outcome.result, auditEventId: outcome.auditEventId };
    },
  };
}
