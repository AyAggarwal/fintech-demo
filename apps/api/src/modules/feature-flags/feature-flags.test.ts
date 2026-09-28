import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { featureFlagListResponseSchema, featureFlagUpdateResponseSchema } from '@fintech-demo/contracts';
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

async function flagByKey(key: string): Promise<{ id: string; enabled: boolean }> {
  return harness.db.featureFlag.findUniqueOrThrow({ where: { key }, select: { id: true, enabled: true } });
}

describe('feature flags', () => {
  it('lets an administrator toggle a flag and records exactly one audit event', async () => {
    const admin = await harness.signIn('admin');
    const flag = await flagByKey('console.dark-mode');
    expect(flag.enabled).toBe(false);

    const response = await admin.mutate('PATCH', `/api/feature-flags/${flag.id}`, { enabled: true, reason: 'Pilot group' });

    expect(response.statusCode).toBe(200);
    const body = featureFlagUpdateResponseSchema.parse(response.json());
    expect(body.flag.enabled).toBe(true);
    expect(body.flag.updatedByName).toBe('Demo Administrator');

    const events = await harness.db.auditEvent.findMany({ where: { entityType: 'FEATURE_FLAG', entityId: flag.id } });
    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe(body.auditEventId);
    expect(events[0]?.action).toBe('feature_flag.enabled');
    expect(events[0]?.entityLabel).toBe('console.dark-mode');
    expect(events[0]?.before).toMatchObject({ enabled: false });
    expect(events[0]?.after).toMatchObject({ enabled: true });
  });

  it('blocks an analyst from toggling a flag at the API', async () => {
    const analyst = await harness.signIn('analyst');
    const flag = await flagByKey('console.dark-mode');

    const response = await analyst.mutate('PATCH', `/api/feature-flags/${flag.id}`, { enabled: true });

    expect(response.statusCode).toBe(403);
    expect(errorCode(response)).toBe('FORBIDDEN');
    expect((await flagByKey('console.dark-mode')).enabled).toBe(false);
    expect(await harness.db.auditEvent.count()).toBe(0);
  });

  it('treats a no-op update as a conflict and records nothing', async () => {
    const admin = await harness.signIn('admin');
    const flag = await flagByKey('kyc.enhanced-review-queue');
    expect(flag.enabled).toBe(true);

    const response = await admin.mutate('PATCH', `/api/feature-flags/${flag.id}`, { enabled: true });

    expect(response.statusCode).toBe(409);
    expect(errorCode(response)).toBe('CONFLICT');
    expect(response.json()).toMatchObject({
      error: { message: 'Feature flag kyc.enhanced-review-queue is already enabled' },
    });
    expect(await harness.db.auditEvent.count()).toBe(0);
  });

  it('records only one change when competing toggles race', async () => {
    const admin = await harness.signIn('admin');
    const flag = await flagByKey('ops.bulk-actions');

    const results = await Promise.all([
      admin.mutate('PATCH', `/api/feature-flags/${flag.id}`, { enabled: true }),
      admin.mutate('PATCH', `/api/feature-flags/${flag.id}`, { enabled: true }),
      admin.mutate('PATCH', `/api/feature-flags/${flag.id}`, { enabled: true }),
    ]);

    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409, 409]);
    expect((await flagByKey('ops.bulk-actions')).enabled).toBe(true);
    expect(await harness.db.auditEvent.count({ where: { entityId: flag.id } })).toBe(1);
  });

  it('validates the body', async () => {
    const admin = await harness.signIn('admin');
    const flag = await flagByKey('console.dark-mode');

    const response = await admin.mutate('PATCH', `/api/feature-flags/${flag.id}`, { enabled: 'yes' });

    expect(response.statusCode).toBe(400);
    expect(errorCode(response)).toBe('VALIDATION_ERROR');
  });

  it('lists flags for every signed-in role', async () => {
    const viewer = await harness.signIn('viewer');
    const body = featureFlagListResponseSchema.parse((await viewer.get('/api/feature-flags')).json());
    expect(body.items.map((item) => item.key)).toContain('console.dark-mode');
  });
});
