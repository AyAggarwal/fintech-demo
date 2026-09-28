import type { FastifyInstance, FastifyRequest } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import type { Actor } from '../authorization/index.js';
import { UnauthenticatedError } from '../errors/index.js';
import { assertSameOriginMutation } from './csrf.js';
import { readSessionId } from './session-cookie.js';
import type { SessionStore } from './session-store.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Resolved from the session cookie on every request; null when anonymous. */
    actor: Actor | null;
  }
}

export interface AuthenticationOptions {
  sessionStore: SessionStore;
  cookieSecret: string;
  allowedOrigins: readonly string[];
}

/** Registers cookie parsing, actor resolution and CSRF protection for the whole app. */
export async function registerAuthentication(app: FastifyInstance, options: AuthenticationOptions): Promise<void> {
  await app.register(fastifyCookie, { secret: options.cookieSecret });
  app.decorateRequest('actor', null);

  app.addHook('onRequest', async (request) => {
    const sessionId = readSessionId(request);
    request.actor = sessionId ? await options.sessionStore.resolveActor(sessionId) : null;
  });

  app.addHook('preHandler', async (request) => {
    assertSameOriginMutation(request, { allowedOrigins: options.allowedOrigins });
  });
}

/** Use in routes that need a signed-in actor. Throws a consistent 401 otherwise. */
export function requireActor(request: FastifyRequest): Actor {
  if (!request.actor) {
    throw new UnauthenticatedError();
  }
  return request.actor;
}
