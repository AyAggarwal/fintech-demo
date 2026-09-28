import type { DecisionRequest, KycCaseDetail, KycCaseSummary, KycDecisionResponse, KycListQuery } from '@fintech-demo/contracts';
import { requirePermission } from '../../platform/authorization/index.js';
import type { Actor } from '../../platform/authorization/index.js';
import type { DatabaseClient } from '../../platform/database/index.js';
import { ConflictError, NotFoundError } from '../../platform/errors/index.js';
import { executePrivilegedAction } from '../../platform/policies/index.js';
import { applyKycDecision, findKycCaseDetail, listKycCases } from './kyc-repository.js';

export interface KycService {
  list(actor: Actor, query: KycListQuery): Promise<KycCaseSummary[]>;
  get(actor: Actor, id: string): Promise<KycCaseDetail>;
  decide(actor: Actor, id: string, request: DecisionRequest): Promise<KycDecisionResponse>;
}

export interface KycServiceDependencies {
  db: DatabaseClient;
  now?: () => Date;
}

function decisionSnapshot(kycCase: KycCaseDetail): Record<string, string | null> {
  return {
    status: kycCase.status,
    decidedAt: kycCase.decidedAt,
    decidedByName: kycCase.decidedByName,
    decisionReason: kycCase.decisionReason,
  };
}

/** KYC decisions here are manual, fictional review outcomes. No vendor or document verification is involved. */
export function createKycService({ db, now = () => new Date() }: KycServiceDependencies): KycService {
  return {
    async list(actor, query) {
      requirePermission(actor, 'kyc:read');
      return listKycCases(db, query);
    },

    async get(actor, id) {
      requirePermission(actor, 'kyc:read');
      const kycCase = await findKycCaseDetail(db, id);
      if (!kycCase) {
        throw new NotFoundError('KYC case', id);
      }
      return kycCase;
    },

    async decide(actor, id, request) {
      const outcome = await executePrivilegedAction(db, {
        actor,
        permission: 'kyc:decide',
        action: request.decision === 'APPROVED' ? 'kyc.approved' : 'kyc.rejected',
        entityType: 'KYC_CASE',
        input: request,
        apply: async (tx, { reason }) => {
          const before = await findKycCaseDetail(tx, id);
          if (!before) {
            throw new NotFoundError('KYC case', id);
          }
          if (before.status !== 'PENDING') {
            throw new ConflictError(`KYC case ${before.reference} is already ${before.status.toLowerCase()}`);
          }
          const changed = await applyKycDecision(tx, {
            id,
            decision: request.decision,
            actorId: actor.id,
            reason,
            decidedAt: now(),
          });
          if (changed !== 1) {
            throw new ConflictError(`KYC case ${before.reference} was decided by another request`);
          }
          const after = await findKycCaseDetail(tx, id);
          if (!after) {
            throw new NotFoundError('KYC case', id);
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
      return { kycCase: outcome.result, decision: request.decision, auditEventId: outcome.auditEventId };
    },
  };
}
