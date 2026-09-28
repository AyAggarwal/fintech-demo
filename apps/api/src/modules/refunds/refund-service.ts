import type { DecisionRequest, RefundDecisionResponse, RefundDetail, RefundListQuery, RefundSummary } from '@fintech-demo/contracts';
import { requirePermission } from '../../platform/authorization/index.js';
import type { Actor } from '../../platform/authorization/index.js';
import type { DatabaseClient } from '../../platform/database/index.js';
import { ConflictError, NotFoundError } from '../../platform/errors/index.js';
import { executePrivilegedAction } from '../../platform/policies/index.js';
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

function decisionSnapshot(refund: RefundDetail): Record<string, string | null> {
  return {
    status: refund.status,
    decidedAt: refund.decidedAt,
    decidedByName: refund.decidedByName,
    decisionReason: refund.decisionReason,
  };
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
        apply: async (tx, { reason }) => {
          const before = await findRefundDetail(tx, id);
          if (!before) {
            throw new NotFoundError('Refund', id);
          }
          if (before.status !== 'PENDING') {
            throw new ConflictError(`Refund ${before.reference} is already ${before.status.toLowerCase()}`);
          }
          const changed = await applyRefundDecision(tx, {
            id,
            decision: request.decision,
            actorId: actor.id,
            reason,
            decidedAt: now(),
          });
          if (changed !== 1) {
            throw new ConflictError(`Refund ${before.reference} was decided by another request`);
          }
          const after = await findRefundDetail(tx, id);
          if (!after) {
            throw new NotFoundError('Refund', id);
          }
          return {
            entityId: after.id,
            entityLabel: after.reference,
            before: decisionSnapshot(before),
            after: decisionSnapshot(after),
            result: after,
          };
        },
      });
      return { refund: outcome.result, decision: request.decision, auditEventId: outcome.auditEventId };
    },
  };
}
