import type { DecisionRequest, RefundDecisionResponse, RefundDetail, RefundListQuery, RefundSummary } from '@fintech-demo/contracts';
import { requirePermission } from '../../platform/authorization/index.js';
import type { Actor } from '../../platform/authorization/index.js';
import type { DatabaseClient } from '../../platform/database/index.js';
import { NotFoundError } from '../../platform/errors/index.js';
import { applyGuardedTransition, decisionSnapshot, executePrivilegedAction } from '../../platform/policies/index.js';
import { applyRefundDecision, findRefundDetail, listRefunds } from './refund-repository.js';

export interface RefundService {
  list(actor: Actor, query: RefundListQuery): Promise<RefundSummary[]>;
  get(actor: Actor, id: string): Promise<RefundDetail>;
  decide(actor: Actor, id: string, request: DecisionRequest): Promise<RefundDecisionResponse>;
}

export interface RefundServiceDependencies {
  db: DatabaseClient;
  now?: () => Date;
}

/** Approving a refund records a simulated decision only. No money moves and no processor is called. */
export function createRefundService({ db, now = () => new Date() }: RefundServiceDependencies): RefundService {
  return {
    async list(actor, query) {
      requirePermission(actor, 'refunds:read');
      return listRefunds(db, query);
    },

    async get(actor, id) {
      requirePermission(actor, 'refunds:read');
      const refund = await findRefundDetail(db, id);
      if (!refund) {
        throw new NotFoundError('Refund', id);
      }
      return refund;
    },

    async decide(actor, id, request) {
      const outcome = await executePrivilegedAction(db, {
        actor,
        permission: 'refunds:decide',
        action: request.decision === 'APPROVED' ? 'refund.approved' : 'refund.rejected',
        entityType: 'REFUND',
        input: request,
        apply: (tx, { reason }) =>
          applyGuardedTransition(tx, {
            entityName: 'Refund',
            id,
            find: findRefundDetail,
            label: (refund) => refund.reference,
            snapshot: decisionSnapshot,
            rejectTransition: (refund) =>
              refund.status === 'PENDING' ? null : `Refund ${refund.reference} is already ${refund.status.toLowerCase()}`,
            apply: (tx) =>
              applyRefundDecision(tx, { id, decision: request.decision, actorId: actor.id, reason, decidedAt: now() }),
            lostRaceMessage: (refund) => `Refund ${refund.reference} was decided by another request`,
          }),
      });
      return { refund: outcome.result, decision: request.decision, auditEventId: outcome.auditEventId };
    },
  };
}
