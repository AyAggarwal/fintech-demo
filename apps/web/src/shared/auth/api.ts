import { currentUserSchema, demoIdentitiesResponseSchema, sessionResponseSchema } from '@fintech-demo/contracts';
import type { CurrentUser, DemoIdentityKey, DemoIdentitySummary } from '@fintech-demo/contracts';
import { z } from 'zod';
import { apiRequest } from '../api/index.js';

const loginResponseSchema = z.object({ user: currentUserSchema });
const okResponseSchema = z.object({ ok: z.literal(true) });

export async function fetchSession(): Promise<CurrentUser | null> {
  const response = await apiRequest('/api/auth/session', sessionResponseSchema);
  return response.user;
}

export async function fetchDemoIdentities(): Promise<DemoIdentitySummary[]> {
  const response = await apiRequest('/api/auth/demo-identities', demoIdentitiesResponseSchema);
  return response.identities;
}

export async function demoLogin(identity: DemoIdentityKey): Promise<CurrentUser> {
  const response = await apiRequest('/api/auth/demo-login', loginResponseSchema, { method: 'POST', body: { identity } });
  return response.user;
}

export async function logout(): Promise<void> {
  await apiRequest('/api/auth/logout', okResponseSchema, { method: 'POST' });
}
