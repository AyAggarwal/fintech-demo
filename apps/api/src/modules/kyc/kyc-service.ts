import type { DecisionRequest, KycCaseDetail, KycCaseSummary, KycDecisionResponse, KycListQuery } from '@fintech-demo/contracts';
import { requirePermission } from '../../platform/authorization/index.js';
import type { Actor } from '../../platform/authorization/index.js';
import type { DatabaseClient } from '../../platform/database/index.js';
import { NotFoundError } from '../../platform/errors/index.js';
import { applyGuardedTransition, decisionSnapshot, executePrivilegedAction } from '../../platform/policies/index.js';
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
        apply: (tx, { reason }) =>
          applyGuardedTransition(tx, {
            entityName: 'KYC case',
            id,
            find: findKycCaseDetail,
            label: (kycCase) => kycCase.reference,
            snapshot: decisionSnapshot,
            rejectTransition: (kycCase) =>
              kycCase.status === 'PENDING' ? null : `KYC case ${kycCase.reference} is already ${kycCase.status.toLowerCase()}`,
            apply: (tx) =>
              applyKycDecision(tx, { id, decision: request.decision, actorId: actor.id, reason, decidedAt: now() }),
            lostRaceMessage: (kycCase) => `KYC case ${kycCase.reference} was decided by another request`,
          }),
      });
      return { kycCase: outcome.result, decision: request.decision, auditEventId: outcome.auditEventId };
    },
  };
}
