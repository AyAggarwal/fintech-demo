import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { kycDecisionResponseSchema, kycListResponseSchema } from '@fintech-demo/contracts';
import { createTestHarness, errorCode } from '../../test/harness.js';
import type { TestHarness } from '../../test/harness.js';

let harness: TestHarness;

beforeAll(async () => {
  harness = await createTestHarness();
});

afterAll(async () => {
  await harness.close();
});

beforeEach(async () => {
  await harness.reset();
});

async function pendingCaseId(): Promise<string> {
  const kycCase = await harness.db.kycCase.findFirstOrThrow({ where: { status: 'PENDING' }, orderBy: { reference: 'asc' } });
  return kycCase.id;
}

describe('KYC decisions', () => {
  it('lets an analyst reject a pending case and records exactly one matching audit event', async () => {
    const analyst = await harness.signIn('analyst');
    const id = await pendingCaseId();

    const response = await analyst.mutate('POST', `/api/kyc-cases/${id}/decision`, { decision: 'REJECTED' });

    expect(response.statusCode).toBe(200);
    const body = kycDecisionResponseSchema.parse(response.json());
    expect(body.kycCase.status).toBe('REJECTED');
    expect(body.kycCase.decisionReason).toBeNull();

    const events = await harness.db.auditEvent.findMany({ where: { entityType: 'KYC_CASE', entityId: id } });
    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe(body.auditEventId);
    expect(events[0]?.action).toBe('kyc.rejected');
    expect(events[0]?.reason).toBeNull();
    expect(events[0]?.before).toMatchObject({ status: 'PENDING' });
    expect(events[0]?.after).toMatchObject({ status: 'REJECTED' });
  });

  it('cannot decide the same case twice, including competing attempts', async () => {
    const analyst = await harness.signIn('analyst');
    const id = await pendingCaseId();

    const results = await Promise.all([
      analyst.mutate('POST', `/api/kyc-cases/${id}/decision`, { decision: 'APPROVED' }),
      analyst.mutate('POST', `/api/kyc-cases/${id}/decision`, { decision: 'REJECTED' }),
      analyst.mutate('POST', `/api/kyc-cases/${id}/decision`, { decision: 'APPROVED' }),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409, 409]);

    const again = await analyst.mutate('POST', `/api/kyc-cases/${id}/decision`, { decision: 'APPROVED' });
    expect(again.statusCode).toBe(409);
    expect(errorCode(again)).toBe('CONFLICT');
    const stored = await harness.db.kycCase.findUniqueOrThrow({ where: { id } });
    expect(again.json()).toMatchObject({
      error: { message: `KYC case ${stored.reference} is already ${stored.status.toLowerCase()}` },
    });
    expect(await harness.db.auditEvent.count({ where: { entityId: id } })).toBe(1);
  });

  it('rejects an over-long reason without mutating state', async () => {
    const analyst = await harness.signIn('analyst');
    const id = await pendingCaseId();

    const response = await analyst.mutate('POST', `/api/kyc-cases/${id}/decision`, {
      decision: 'APPROVED',
      reason: 'x'.repeat(501),
    });

    expect(response.statusCode).toBe(400);
    expect(errorCode(response)).toBe('VALIDATION_ERROR');
    expect((await harness.db.kycCase.findUniqueOrThrow({ where: { id } })).status).toBe('PENDING');
    expect(await harness.db.auditEvent.count()).toBe(0);
  });

  it('filters the list by status and risk level', async () => {
    const viewer = await harness.signIn('viewer');
    const response = await viewer.get('/api/kyc-cases?status=PENDING&riskLevel=HIGH');
    const body = kycListResponseSchema.parse(response.json());
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((item) => item.status === 'PENDING' && item.riskLevel === 'HIGH')).toBe(true);
  });
});
