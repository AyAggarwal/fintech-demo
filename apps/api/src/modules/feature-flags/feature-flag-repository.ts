import type { FeatureFlag } from '@fintech-demo/contracts';
import type { Prisma } from '@prisma/client';
import type { DatabaseClient, TransactionClient } from '../../platform/database/index.js';

const flagInclude = {
  updatedBy: { select: { displayName: true } },
} satisfies Prisma.FeatureFlagInclude;

type FeatureFlagRecord = Prisma.FeatureFlagGetPayload<{ include: typeof flagInclude }>;

function toFeatureFlag(record: FeatureFlagRecord): FeatureFlag {
  return {
    id: record.id,
    key: record.key,
    description: record.description,
    enabled: record.enabled,
    updatedAt: record.updatedAt.toISOString(),
    updatedByName: record.updatedBy?.displayName ?? null,
  };
}

export async function listFeatureFlags(db: DatabaseClient): Promise<FeatureFlag[]> {
  const records = await db.featureFlag.findMany({ include: flagInclude, orderBy: { key: 'asc' } });
  return records.map(toFeatureFlag);
}

export async function findFeatureFlag(db: DatabaseClient | TransactionClient, id: string): Promise<FeatureFlag | null> {
  const record = await db.featureFlag.findUnique({ where: { id }, include: flagInclude });
  return record ? toFeatureFlag(record) : null;
}

export interface ApplyFlagChangeInput {
  id: string;
  enabled: boolean;
  actorId: string;
}

/** Guarded on the previous value so two competing toggles cannot both be recorded as changes. */
export async function applyFeatureFlagChange(tx: TransactionClient, input: ApplyFlagChangeInput): Promise<number> {
  const result = await tx.featureFlag.updateMany({
    where: { id: input.id, enabled: !input.enabled },
    data: { enabled: input.enabled, updatedById: input.actorId },
  });
  return result.count;
}
