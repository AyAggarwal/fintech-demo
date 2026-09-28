import type { JsonValue } from '@fintech-demo/contracts';
import type { TransactionClient } from '../database/index.js';
import { ConflictError, NotFoundError } from '../errors/index.js';
import type { AppliedChange } from './privileged-action.js';

export interface GuardedTransition<TEntity> {
  /** Human-readable entity name used in NotFound errors, e.g. "Refund". */
  entityName: string;
  id: string;
  find: (tx: TransactionClient, id: string) => Promise<TEntity | null>;
  label: (entity: TEntity) => string;
  snapshot: (entity: TEntity) => JsonValue;
  /** Returns a conflict message when `before` cannot make this transition, or null when it can. */
  rejectTransition: (before: TEntity) => string | null;
  /** Applies the conditional update and returns the number of rows it changed. */
  apply: (tx: TransactionClient) => Promise<number>;
  /** Conflict message when the conditional update lost a race with a concurrent request. */
  lostRaceMessage: (before: TEntity) => string;
}

/**
 * Optimistic state transition inside a privileged action: load the entity, check it may transition,
 * apply a conditional update that must change exactly one row, then reload it for the audit snapshot.
 */
export async function applyGuardedTransition<TEntity extends { id: string }>(
  tx: TransactionClient,
  transition: GuardedTransition<TEntity>,
): Promise<AppliedChange<TEntity>> {
  const { entityName, id } = transition;
  const before = await transition.find(tx, id);
  if (!before) {
    throw new NotFoundError(entityName, id);
  }
  const rejection = transition.rejectTransition(before);
  if (rejection !== null) {
    throw new ConflictError(rejection);
  }
  const changed = await transition.apply(tx);
  if (changed !== 1) {
    throw new ConflictError(transition.lostRaceMessage(before));
  }
  const after = await transition.find(tx, id);
  if (!after) {
    throw new NotFoundError(entityName, id);
  }
  return {
    entityId: after.id,
    entityLabel: transition.label(after),
    before: transition.snapshot(before),
    after: transition.snapshot(after),
    result: after,
  };
}

export interface DecidableEntity {
  status: string;
  decidedAt: string | null;
  decidedByName: string | null;
  decisionReason: string | null;
}

export function decisionSnapshot(entity: DecidableEntity): Record<string, string | null> {
  return {
    status: entity.status,
    decidedAt: entity.decidedAt,
    decidedByName: entity.decidedByName,
    decisionReason: entity.decisionReason,
  };
}
