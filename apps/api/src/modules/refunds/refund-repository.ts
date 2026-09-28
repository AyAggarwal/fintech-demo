import type { Decision, RefundDetail, RefundListQuery, RefundSummary } from '@fintech-demo/contracts';
import type { Prisma } from '@prisma/client';
import type { DatabaseClient, TransactionClient } from '../../platform/database/index.js';

const detailInclude = {
  transaction: true,
  decidedBy: { select: { displayName: true } },
} satisfies Prisma.RefundInclude;

type RefundRecord = Prisma.RefundGetPayload<{ include: typeof detailInclude }>;

function toSummary(record: RefundRecord): RefundSummary {
  return {
    id: record.id,
    reference: record.reference,
    status: record.status,
    amountCents: record.amountCents,
    currency: record.currency,
    customerLabel: record.customerLabel,
    requestReason: record.requestReason,
    createdAt: record.createdAt.toISOString(),
    decidedAt: record.decidedAt?.toISOString() ?? null,
  };
}

function toDetail(record: RefundRecord): RefundDetail {
  return {
    ...toSummary(record),
    decisionReason: record.decisionReason,
    decidedByName: record.decidedBy?.displayName ?? null,
    transaction: {
      id: record.transaction.id,
      reference: record.transaction.reference,
      merchantName: record.transaction.merchantName,
      amountCents: record.transaction.amountCents,
      currency: record.transaction.currency,
      occurredAt: record.transaction.occurredAt.toISOString(),
      cardLast4: record.transaction.cardLast4,
    },
  };
}

export async function listRefunds(db: DatabaseClient, query: RefundListQuery): Promise<RefundSummary[]> {
  const records = await db.refund.findMany({
    where: {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { reference: { contains: query.search, mode: 'insensitive' } },
              { customerLabel: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: detailInclude,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
  return records.map(toSummary);
}

export async function findRefundDetail(db: DatabaseClient | TransactionClient, id: string): Promise<RefundDetail | null> {
  const record = await db.refund.findUnique({ where: { id }, include: detailInclude });
  return record ? toDetail(record) : null;
}

export interface ApplyRefundDecisionInput {
  id: string;
  decision: Decision;
  actorId: string;
  reason: string | null;
  decidedAt: Date;
}

/**
 * Transitions a refund out of PENDING. The status guard in the WHERE clause is what makes
 * competing decisions safe: only one of two concurrent updates can match the pending row.
 * Returns the number of rows changed (0 or 1).
 */
export async function applyRefundDecision(tx: TransactionClient, input: ApplyRefundDecisionInput): Promise<number> {
  const result = await tx.refund.updateMany({
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
