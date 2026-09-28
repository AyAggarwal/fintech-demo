import type { FastifyInstance } from 'fastify';
import { demoLoginRequestSchema } from '@fintech-demo/contracts';
import type { CurrentUser, DemoIdentitiesResponse, SessionResponse } from '@fintech-demo/contracts';
import { clearSessionCookie, readSessionId, setSessionCookie } from '../../platform/auth/index.js';
import type { SessionCookieOptions, SessionStore } from '../../platform/auth/index.js';
import { NotFoundError } from '../../platform/errors/index.js';
import { parseInput } from '../../platform/http/index.js';
import type { IdentityProvider } from './demo-identity-provider.js';

export interface AuthRoutesOptions {
  sessionStore: SessionStore;
  identityProvider: IdentityProvider;
  cookie: SessionCookieOptions;
  /** Demo login is only mounted when this is true (DEMO_AUTH_ENABLED=true). */
  demoAuthEnabled: boolean;
}

export function registerAuthRoutes(app: FastifyInstance, options: AuthRoutesOptions): void {
  app.get('/api/auth/session', async (request): Promise<SessionResponse> => {
    const actor = request.actor;
    const user: CurrentUser | null = actor
      ? { id: actor.id, displayName: actor.displayName, role: actor.role, permissions: [...actor.permissions] }
      : null;
    return { user };
  });

  app.post('/api/auth/logout', async (request, reply): Promise<{ ok: true }> => {
    const sessionId = readSessionId(request);
    if (sessionId) {
      await options.sessionStore.destroy(sessionId);
    }
    clearSessionCookie(reply, options.cookie);
    return { ok: true };
  });

  if (!options.demoAuthEnabled) {
    return;
  }

  app.get('/api/auth/demo-identities', async (): Promise<DemoIdentitiesResponse> => {
    return { identities: await options.identityProvider.listDemoIdentities() };
  });

  app.post('/api/auth/demo-login', async (request, reply): Promise<SessionResponse> => {
    const body = parseInput(demoLoginRequestSchema, request.body, 'login request');
    const identity = await options.identityProvider.resolveDemoIdentity(body.identity);
    if (!identity) {
      throw new NotFoundError('Demo identity', body.identity);
    }
    const previousSessionId = readSessionId(request);
    if (previousSessionId) {
      await options.sessionStore.destroy(previousSessionId);
    }
    const session = await options.sessionStore.create(identity.id);
    setSessionCookie(reply, session.id, session.expiresAt, options.cookie);
    const actor = await options.sessionStore.resolveActor(session.id);
    if (!actor) {
      throw new NotFoundError('Session', session.id);
    }
    return { user: { id: actor.id, displayName: actor.displayName, role: actor.role, permissions: [...actor.permissions] } };
  });
}
