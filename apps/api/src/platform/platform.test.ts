import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auditEventSchema, auditListResponseSchema, CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from '@fintech-demo/contracts';
import { buildApp } from '../app.js';
import { createTestHarness, errorCode } from '../test/harness.js';
import type { TestHarness } from '../test/harness.js';

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

async function pendingIds(): Promise<{ refundId: string; kycCaseId: string; flagId: string }> {
  const [refund, kycCase, flag] = await Promise.all([
    harness.db.refund.findFirstOrThrow({ where: { status: 'PENDING' } }),
    harness.db.kycCase.findFirstOrThrow({ where: { status: 'PENDING' } }),
    harness.db.featureFlag.findFirstOrThrow({ where: { enabled: false } }),
  ]);
  return { refundId: refund.id, kycCaseId: kycCase.id, flagId: flag.id };
}

async function expectUnchanged(ids: { refundId: string; kycCaseId: string; flagId: string }): Promise<void> {
  expect((await harness.db.refund.findUniqueOrThrow({ where: { id: ids.refundId } })).status).toBe('PENDING');
  expect((await harness.db.kycCase.findUniqueOrThrow({ where: { id: ids.kycCaseId } })).status).toBe('PENDING');
  expect((await harness.db.featureFlag.findUniqueOrThrow({ where: { id: ids.flagId } })).enabled).toBe(false);
  expect(await harness.db.auditEvent.count()).toBe(0);
}

describe('authorization', () => {
  it('a viewer can read every app but cannot mutate any of them', async () => {
    const viewer = await harness.signIn('viewer');
    const ids = await pendingIds();

    for (const url of ['/api/refunds', '/api/kyc-cases', '/api/feature-flags', '/api/audit-events']) {
      expect((await viewer.get(url)).statusCode).toBe(200);
    }

    const attempts = await Promise.all([
      viewer.mutate('POST', `/api/refunds/${ids.refundId}/decision`, { decision: 'APPROVED' }),
      viewer.mutate('POST', `/api/kyc-cases/${ids.kycCaseId}/decision`, { decision: 'APPROVED' }),
      viewer.mutate('PATCH', `/api/feature-flags/${ids.flagId}`, { enabled: true }),
    ]);
    for (const attempt of attempts) {
      expect(attempt.statusCode).toBe(403);
      expect(errorCode(attempt)).toBe('FORBIDDEN');
    }
    await expectUnchanged(ids);
  });

  it('ignores actor and role fields supplied in the request body', async () => {
    const viewer = await harness.signIn('viewer');
    const ids = await pendingIds();

    const response = await viewer.mutate('POST', `/api/refunds/${ids.refundId}/decision`, {
      decision: 'APPROVED',
      role: 'ADMIN',
      actorId: 'someone-else',
    });

    expect(response.statusCode).toBe(403);
    await expectUnchanged(ids);
  });
});

describe('authentication and same-origin protection', () => {
  it('rejects unauthenticated reads and mutations', async () => {
    const ids = await pendingIds();

    const read = await harness.app.inject({ method: 'GET', url: '/api/refunds' });
    expect(read.statusCode).toBe(401);
    expect(errorCode(read)).toBe('UNAUTHENTICATED');

    const write = await harness.app.inject({
      method: 'POST',
      url: `/api/refunds/${ids.refundId}/decision`,
      headers: { [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE },
      payload: { decision: 'APPROVED' },
    });
    expect(write.statusCode).toBe(401);
    await expectUnchanged(ids);
  });

  it('rejects mutations without the same-origin marker header or from a foreign origin', async () => {
    const admin = await harness.signIn('admin');
    const ids = await pendingIds();

    const missingHeader = await admin.mutate('PATCH', `/api/feature-flags/${ids.flagId}`, { enabled: true }, {
      [CSRF_HEADER_NAME]: 'something-else',
    });
    expect(missingHeader.statusCode).toBe(403);

    const foreignOrigin = await admin.mutate('PATCH', `/api/feature-flags/${ids.flagId}`, { enabled: true }, {
      origin: 'https://evil.example',
    });
    expect(foreignOrigin.statusCode).toBe(403);

    const crossSite = await admin.mutate('PATCH', `/api/feature-flags/${ids.flagId}`, { enabled: true }, {
      'sec-fetch-site': 'cross-site',
    });
    expect(crossSite.statusCode).toBe(403);

    await expectUnchanged(ids);
  });

  it('only allows seeded identities through demo login', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/auth/demo-login',
      headers: { [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE },
      payload: { identity: 'superuser' },
    });
    expect(response.statusCode).toBe(400);
    expect(errorCode(response)).toBe('VALIDATION_ERROR');
  });

  it('lists only users whose demo key is a known demo identity', async () => {
    const stray = await harness.db.user.create({ data: { demoKey: 'superuser', displayName: 'Stray', role: 'ADMIN' } });
    try {
      const response = await harness.app.inject({ method: 'GET', url: '/api/auth/demo-identities' });
      expect(response.statusCode).toBe(200);
      const { identities } = response.json<{ identities: { key: string }[] }>();
      expect(identities.map((identity) => identity.key)).toEqual(['admin', 'analyst', 'viewer']);
    } finally {
      await harness.db.user.delete({ where: { id: stray.id } });
    }
  });

  it('does not mount demo login when demo auth is disabled', async () => {
    const app = await buildApp({
      config: {
        databaseUrl: 'unused',
        port: 0,
        host: '127.0.0.1',
        webOrigin: 'http://localhost:5173',
        demoAuthEnabled: false,
        sessionSecret: 'integration-test-secret-0123456789abcdef',
        secureCookies: false,
      },
      db: harness.db,
    });
    try {
      const login = await app.inject({
        method: 'POST',
        url: '/api/auth/demo-login',
        headers: { [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE },
        payload: { identity: 'admin' },
      });
      expect(login.statusCode).toBe(404);
      expect((await app.inject({ method: 'GET', url: '/api/auth/demo-identities' })).statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('logout invalidates the session', async () => {
    const viewer = await harness.signIn('viewer');
    expect((await viewer.get('/api/auth/session')).json()).toMatchObject({ user: { role: 'VIEWER' } });

    expect((await viewer.mutate('POST', '/api/auth/logout')).statusCode).toBe(200);

    expect((await viewer.get('/api/refunds')).statusCode).toBe(401);
  });
});

describe('audit trail', () => {
  it('is readable by every role, filterable, and exposes no write endpoints', async () => {
    const analyst = await harness.signIn('analyst');
    const ids = await pendingIds();
    await analyst.mutate('POST', `/api/refunds/${ids.refundId}/decision`, { decision: 'APPROVED' });
    await analyst.mutate('POST', `/api/kyc-cases/${ids.kycCaseId}/decision`, { decision: 'REJECTED' });

    const viewer = await harness.signIn('viewer');
    const all = auditListResponseSchema.parse((await viewer.get('/api/audit-events')).json());
    expect(all.items.map((event) => event.action).sort()).toEqual(['kyc.rejected', 'refund.approved']);

    const refundsOnly = auditListResponseSchema.parse((await viewer.get('/api/audit-events?entityType=REFUND')).json());
    expect(refundsOnly.items).toHaveLength(1);
    const [event] = refundsOnly.items;
    if (!event) {
      throw new Error('expected one refund audit event');
    }
    const detail = auditEventSchema.parse((await viewer.get(`/api/audit-events/${event.id}`)).json());
    expect(detail.entityId).toBe(ids.refundId);
    expect(detail.actorRole).toBe('OPS_ANALYST');

    const admin = await harness.signIn('admin');
    for (const method of ['PATCH', 'PUT', 'DELETE'] as const) {
      const response = await admin.mutate(method, `/api/audit-events/${event.id}`, {});
      expect(response.statusCode).toBe(404);
    }
    expect(await harness.db.auditEvent.count()).toBe(2);
  });
});
