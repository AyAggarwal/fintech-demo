import { riskFlagSchema } from '@fintech-demo/contracts';
import type { Decision, KycCaseDetail, KycCaseSummary, KycListQuery, RiskFlag } from '@fintech-demo/contracts';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { DatabaseClient, TransactionClient } from '../../platform/database/index.js';

const detailInclude = {
  decidedBy: { select: { displayName: true } },
} satisfies Prisma.KycCaseInclude;

type KycCaseRecord = Prisma.KycCaseGetPayload<{ include: typeof detailInclude }>;

const riskFlagsColumnSchema = z.array(riskFlagSchema);

function parseRiskFlags(value: KycCaseRecord['riskFlags']): RiskFlag[] {
  return riskFlagsColumnSchema.parse(value);
}

function toSummary(record: KycCaseRecord, riskFlags: RiskFlag[]): KycCaseSummary {
  return {
    id: record.id,
    reference: record.reference,
    status: record.status,
    applicantLabel: record.applicantLabel,
    accountType: record.accountType,
    riskLevel: record.riskLevel,
    riskFlagCount: riskFlags.length,
    createdAt: record.createdAt.toISOString(),
    decidedAt: record.decidedAt?.toISOString() ?? null,
  };
}

function toDetail(record: KycCaseRecord): KycCaseDetail {
  const riskFlags = parseRiskFlags(record.riskFlags);
  return {
    ...toSummary(record, riskFlags),
    riskFlags,
    notes: record.notes,
    decisionReason: record.decisionReason,
    decidedByName: record.decidedBy?.displayName ?? null,
  };
}

export async function listKycCases(db: DatabaseClient, query: KycListQuery): Promise<KycCaseSummary[]> {
  const records = await db.kycCase.findMany({
    where: {
      ...(query.status ? { status: query.status } : {}),
      ...(query.riskLevel ? { riskLevel: query.riskLevel } : {}),
      ...(query.search
        ? {
            OR: [
              { reference: { contains: query.search, mode: 'insensitive' } },
              { applicantLabel: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: detailInclude,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
  return records.map((record) => toSummary(record, parseRiskFlags(record.riskFlags)));
}

export async function findKycCaseDetail(db: DatabaseClient | TransactionClient, id: string): Promise<KycCaseDetail | null> {
  const record = await db.kycCase.findUnique({ where: { id }, include: detailInclude });
  return record ? toDetail(record) : null;
}

export interface ApplyKycDecisionInput {
  id: string;
  decision: Decision;
  actorId: string;
  reason: string | null;
  decidedAt: Date;
}

/** Same guarded transition as refunds: only a PENDING row can be decided, so concurrent decisions cannot both succeed. */
export async function applyKycDecision(tx: TransactionClient, input: ApplyKycDecisionInput): Promise<number> {
  const result = await tx.kycCase.updateMany({
    where: { id: input.id, status: 'PENDING' },
    data: {
      status: input.decision,
      decidedAt: input.decidedAt,
      decidedById: input.actorId,
      decisionReason: input.reason,
    },
  });
  return result.count;
}
