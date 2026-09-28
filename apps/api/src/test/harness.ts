import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from '@fintech-demo/contracts';
import type { DemoIdentityKey } from '@fintech-demo/contracts';
import { seedDatabase } from '../../prisma/seed.js';
import { buildApp } from '../app.js';
import { SESSION_COOKIE_NAME } from '../platform/auth/index.js';
import type { AppConfig } from '../platform/config.js';
import { createDatabaseClient } from '../platform/database/index.js';
import type { DatabaseClient } from '../platform/database/index.js';

const TEST_CONFIG: Omit<AppConfig, 'databaseUrl'> = {
  port: 0,
  host: '127.0.0.1',
  webOrigin: 'http://localhost:5173',
  demoAuthEnabled: true,
  sessionSecret: 'integration-test-secret-0123456789abcdef',
  secureCookies: false,
};

export interface TestHarness {
  app: FastifyInstance;
  db: DatabaseClient;
  /** Restores the deterministic seed fixtures. Called before each test. */
  reset(): Promise<void>;
  /** Signs in through the real demo login endpoint and returns the session cookie. */
  signIn(identity: DemoIdentityKey): Promise<TestClient>;
  close(): Promise<void>;
}

export interface TestClient {
  get(url: string): Promise<LightMyRequestResponse>;
  mutate(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, body?: unknown, headers?: Record<string, string>): Promise<LightMyRequestResponse>;
}

function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set; copy .env.example to .env and run `npm run db:test:setup`');
  }
  if (!/_test(\?|$)/.test(url)) {
    throw new Error(`Refusing to run integration tests against non-test database: ${url}`);
  }
  return url;
}

export async function createTestHarness(): Promise<TestHarness> {
  const databaseUrl = requireTestDatabaseUrl();
  const db = createDatabaseClient(databaseUrl);
  const app = await buildApp({ config: { ...TEST_CONFIG, databaseUrl }, db });
  await app.ready();

  const inject = (options: InjectOptions): Promise<LightMyRequestResponse> => app.inject(options);

  return {
    app,
    db,
    reset: () => seedDatabase(db),
    async signIn(identity) {
      const login = await inject({
        method: 'POST',
        url: '/api/auth/demo-login',
        headers: { [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE },
        payload: { identity },
      });
      if (login.statusCode !== 200) {
        throw new Error(`Demo login failed for ${identity}: ${login.body}`);
      }
      const cookie = login.cookies.find((c) => c.name === SESSION_COOKIE_NAME);
      if (!cookie) {
        throw new Error('Demo login did not set a session cookie');
      }
      const cookies = { [SESSION_COOKIE_NAME]: cookie.value };
      return {
        get: (url) => inject({ method: 'GET', url, cookies }),
        mutate: (method, url, body, headers = {}) => {
          const options: InjectOptions = {
            method,
            url,
            cookies,
            headers: { [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE, ...headers },
          };
          if (body !== undefined) {
            options.payload = JSON.stringify(body);
            options.headers = { ...options.headers, 'content-type': 'application/json' };
          }
          return inject(options);
        },
      };
    },
    async close() {
      await app.close();
      await db.$disconnect();
    },
  };
}

export function errorCode(response: LightMyRequestResponse): string {
  const parsed: unknown = response.json();
  if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
    const error = parsed.error;
    if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
      return error.code;
    }
  }
  throw new Error(`Response is not an error envelope: ${response.body}`);
}
