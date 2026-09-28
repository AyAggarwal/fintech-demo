import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { refundDecisionResponseSchema, refundListResponseSchema } from '@fintech-demo/contracts';
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

async function pendingRefundId(): Promise<string> {
  const refund = await harness.db.refund.findFirstOrThrow({ where: { status: 'PENDING' }, orderBy: { reference: 'asc' } });
  return refund.id;
}

describe('refund decisions', () => {
  it('lets an analyst approve a pending refund and records exactly one matching audit event', async () => {
    const analyst = await harness.signIn('analyst');
    const id = await pendingRefundId();

    const response = await analyst.mutate('POST', `/api/refunds/${id}/decision`, {
      decision: 'APPROVED',
      reason: '  Duplicate charge confirmed  ',
    });

    expect(response.statusCode).toBe(200);
    const body = refundDecisionResponseSchema.parse(response.json());
    expect(body.refund.status).toBe('APPROVED');
    expect(body.refund.decidedByName).toBe('Demo Ops Analyst');
    expect(body.refund.decisionReason).toBe('Duplicate charge confirmed');

    const stored = await harness.db.refund.findUniqueOrThrow({ where: { id } });
    expect(stored.status).toBe('APPROVED');

    const events = await harness.db.auditEvent.findMany({ where: { entityType: 'REFUND', entityId: id } });
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event?.id).toBe(body.auditEventId);
    expect(event?.action).toBe('refund.approved');
    expect(event?.actorRole).toBe('OPS_ANALYST');
    expect(event?.reason).toBe('Duplicate charge confirmed');
    expect(event?.before).toMatchObject({ status: 'PENDING' });
    expect(event?.after).toMatchObject({ status: 'APPROVED', decisionReason: 'Duplicate charge confirmed' });
  });

  it('rejects a second decision on the same refund and leaves state untouched', async () => {
    const analyst = await harness.signIn('analyst');
    const id = await pendingRefundId();

    const first = await analyst.mutate('POST', `/api/refunds/${id}/decision`, { decision: 'REJECTED' });
    expect(first.statusCode).toBe(200);

    const second = await analyst.mutate('POST', `/api/refunds/${id}/decision`, { decision: 'APPROVED' });
    expect(second.statusCode).toBe(409);
    expect(errorCode(second)).toBe('CONFLICT');

    const stored = await harness.db.refund.findUniqueOrThrow({ where: { id } });
    expect(stored.status).toBe('REJECTED');
    expect(await harness.db.auditEvent.count({ where: { entityId: id } })).toBe(1);
  });

  it('records only one successful decision when two requests compete', async () => {
    const analyst = await harness.signIn('analyst');
    const admin = await harness.signIn('admin');
    const id = await pendingRefundId();

    const results = await Promise.all([
      analyst.mutate('POST', `/api/refunds/${id}/decision`, { decision: 'APPROVED' }),
      admin.mutate('POST', `/api/refunds/${id}/decision`, { decision: 'REJECTED' }),
      analyst.mutate('POST', `/api/refunds/${id}/decision`, { decision: 'REJECTED' }),
      admin.mutate('POST', `/api/refunds/${id}/decision`, { decision: 'APPROVED' }),
    ]);

    const statuses = results.map((r) => r.statusCode).sort();
    expect(statuses).toEqual([200, 409, 409, 409]);

    const stored = await harness.db.refund.findUniqueOrThrow({ where: { id } });
    const winner = results.find((r) => r.statusCode === 200);
    const winnerBody = refundDecisionResponseSchema.parse(winner?.json());
    expect(stored.status).toBe(winnerBody.decision);
    expect(await harness.db.auditEvent.count({ where: { entityId: id } })).toBe(1);
  });

  it('returns a validation error for an unknown decision without mutating state', async () => {
    const analyst = await harness.signIn('analyst');
    const id = await pendingRefundId();

    const response = await analyst.mutate('POST', `/api/refunds/${id}/decision`, { decision: 'MAYBE' });

    expect(response.statusCode).toBe(400);
    expect(errorCode(response)).toBe('VALIDATION_ERROR');
    const stored = await harness.db.refund.findUniqueOrThrow({ where: { id } });
    expect(stored.status).toBe('PENDING');
    expect(await harness.db.auditEvent.count()).toBe(0);
  });

  it('returns not found for an unknown refund', async () => {
    const analyst = await harness.signIn('analyst');
    const response = await analyst.mutate('POST', '/api/refunds/does-not-exist/decision', { decision: 'APPROVED' });
    expect(response.statusCode).toBe(404);
    expect(errorCode(response)).toBe('NOT_FOUND');
  });

  it('filters the list by status and search', async () => {
    const viewer = await harness.signIn('viewer');

    const pending = refundListResponseSchema.parse((await viewer.get('/api/refunds?status=PENDING')).json());
    expect(pending.items.length).toBeGreaterThan(0);
    expect(pending.items.every((item) => item.status === 'PENDING')).toBe(true);

    const searched = refundListResponseSchema.parse((await viewer.get('/api/refunds?search=RF-1001')).json());
    expect(searched.items.map((item) => item.reference)).toEqual(['RF-1001']);

    const invalid = await viewer.get('/api/refunds?status=NOPE');
    expect(invalid.statusCode).toBe(400);
    expect(errorCode(invalid)).toBe('VALIDATION_ERROR');
  });
});
