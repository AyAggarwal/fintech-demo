import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import { registerAuditRoutes } from './modules/audit/index.js';
import { createSeededIdentityProvider, registerAuthRoutes } from './modules/auth/index.js';
import type { IdentityProvider } from './modules/auth/index.js';
import { createFeatureFlagService, registerFeatureFlagRoutes } from './modules/feature-flags/index.js';
import { createKycService, registerKycRoutes } from './modules/kyc/index.js';
import { createRefundService, registerRefundRoutes } from './modules/refunds/index.js';
import { createSessionStore, registerAuthentication } from './platform/auth/index.js';
import type { SessionStore } from './platform/auth/index.js';
import type { AppConfig } from './platform/config.js';
import type { DatabaseClient } from './platform/database/index.js';
import { errorHandler, notFoundHandler } from './platform/errors/index.js';

export interface AppDependencies {
  config: AppConfig;
  db: DatabaseClient;
  /** Overridable for tests; defaults to the seeded demo identities. */
  identityProvider?: IdentityProvider;
  sessionStore?: SessionStore;
  now?: () => Date;
  logger?: boolean;
}

/** Assembles the HTTP application without starting it, so tests can drive it with `app.inject`. */
export async function buildApp(deps: AppDependencies): Promise<FastifyInstance> {
  const { config, db } = deps;
  const now = deps.now ?? (() => new Date());
  const sessionStore = deps.sessionStore ?? createSessionStore(db, now);
  const identityProvider = deps.identityProvider ?? createSeededIdentityProvider(db);

  const app = Fastify({ logger: deps.logger ?? false });

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  await app.register(fastifyCors, { origin: [config.webOrigin], credentials: true });
  await registerAuthentication(app, {
    sessionStore,
    cookieSecret: config.sessionSecret,
    allowedOrigins: [config.webOrigin, `http://${config.host}:${config.port}`, `http://localhost:${config.port}`],
  });

  app.get('/api/health', async () => ({ ok: true, demoAuth: config.demoAuthEnabled }));

  registerAuthRoutes(app, {
    sessionStore,
    identityProvider,
    cookie: { secure: config.secureCookies },
    demoAuthEnabled: config.demoAuthEnabled,
  });
  registerRefundRoutes(app, createRefundService({ db, now }));
  registerKycRoutes(app, createKycService({ db, now }));
  registerFeatureFlagRoutes(app, createFeatureFlagService({ db }));
  registerAuditRoutes(app, db);

  return app;
}
