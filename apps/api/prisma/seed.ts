import { PrismaClient } from '@prisma/client';
import { SEED_FEATURE_FLAGS, SEED_KYC_CASES, SEED_REFUNDS, SEED_USERS } from './seed-data.js';

/**
 * Resets business data and re-inserts the deterministic fixtures. Safe to run repeatedly.
 * Also used by the integration tests against TEST_DATABASE_URL.
 */
export async function seedDatabase(db: PrismaClient): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.auditEvent.deleteMany();
    await tx.session.deleteMany();
    await tx.refund.deleteMany();
    await tx.syntheticTransaction.deleteMany();
    await tx.kycCase.deleteMany();
    await tx.featureFlag.deleteMany();

    const usersByKey = new Map<string, { id: string }>();
    for (const user of SEED_USERS) {
      const record = await tx.user.upsert({
        where: { demoKey: user.demoKey },
        update: { displayName: user.displayName, role: user.role },
        create: user,
        select: { id: true },
      });
      usersByKey.set(user.demoKey, record);
    }

    const decidedBy = (key: 'analyst' | 'admin'): string => {
      const user = usersByKey.get(key);
      if (!user) {
        throw new Error(`Seed user ${key} missing`);
      }
      return user.id;
    };

    for (const refund of SEED_REFUNDS) {
      await tx.refund.create({
        data: {
          reference: refund.reference,
          status: refund.status,
          amountCents: refund.amountCents,
          currency: refund.currency,
          customerLabel: refund.customerLabel,
          requestReason: refund.requestReason,
          createdAt: new Date(refund.createdAt),
          transaction: {
            create: {
              reference: refund.transaction.reference,
              merchantName: refund.transaction.merchantName,
              amountCents: refund.transaction.amountCents,
              currency: refund.currency,
              cardLast4: refund.transaction.cardLast4,
              occurredAt: new Date(refund.transaction.occurredAt),
            },
          },
          ...(refund.decision
            ? {
                decidedAt: new Date(refund.decision.decidedAt),
                decidedBy: { connect: { id: decidedBy(refund.decision.byDemoKey) } },
                decisionReason: refund.decision.reason,
              }
            : {}),
        },
      });
    }

    for (const kycCase of SEED_KYC_CASES) {
      await tx.kycCase.create({
        data: {
          reference: kycCase.reference,
          status: kycCase.status,
          applicantLabel: kycCase.applicantLabel,
          accountType: kycCase.accountType,
          riskLevel: kycCase.riskLevel,
          riskFlags: kycCase.riskFlags,
          notes: kycCase.notes,
          createdAt: new Date(kycCase.createdAt),
          ...(kycCase.decision
            ? {
                decidedAt: new Date(kycCase.decision.decidedAt),
                decidedBy: { connect: { id: decidedBy(kycCase.decision.byDemoKey) } },
                decisionReason: kycCase.decision.reason,
              }
            : {}),
        },
      });
    }

    for (const flag of SEED_FEATURE_FLAGS) {
      await tx.featureFlag.create({ data: flag });
    }
  });
}

const isDirectRun = process.argv[1]?.endsWith('seed.ts') ?? false;
if (isDirectRun) {
  const db = new PrismaClient();
  seedDatabase(db)
    .then(async () => {
      await db.$disconnect();
      console.log('Seeded demo database');
    })
    .catch(async (error: unknown) => {
      console.error(error);
      await db.$disconnect();
      process.exitCode = 1;
    });
}
