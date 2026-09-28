import type { FeatureFlag, FeatureFlagUpdateRequest, FeatureFlagUpdateResponse } from '@fintech-demo/contracts';
import { requirePermission } from '../../platform/authorization/index.js';
import type { Actor } from '../../platform/authorization/index.js';
import type { DatabaseClient } from '../../platform/database/index.js';
import { applyGuardedTransition, executePrivilegedAction } from '../../platform/policies/index.js';
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
        apply: (tx) =>
          applyGuardedTransition(tx, {
            entityName: 'Feature flag',
            id,
            find: findFeatureFlag,
            label: (flag) => flag.key,
            snapshot: flagSnapshot,
            rejectTransition: (flag) =>
              flag.enabled === request.enabled
                ? `Feature flag ${flag.key} is already ${request.enabled ? 'enabled' : 'disabled'}`
                : null,
            apply: (tx) => applyFeatureFlagChange(tx, { id, enabled: request.enabled, actorId: actor.id }),
            lostRaceMessage: (flag) => `Feature flag ${flag.key} was changed by another request`,
          }),
      });
      return { flag: outcome.result, auditEventId: outcome.auditEventId };
    },
  };
}
