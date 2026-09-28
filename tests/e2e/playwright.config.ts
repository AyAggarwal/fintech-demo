import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { defineConfig } from '@playwright/test';

const repoRoot = resolve(import.meta.dirname, '../..');
// The repo .env wins over shell variables so a global DATABASE_URL cannot redirect the tests.
const rootEnvFile = resolve(repoRoot, '.env');
if (existsSync(rootEnvFile)) {
  Object.assign(process.env, parseEnv(readFileSync(rootEnvFile, 'utf8')));
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is not set; copy .env.example to .env at the repository root');
}

/** The e2e stack runs on its own ports against the test database so it never touches the dev database. */
export const E2E_API_PORT = 3101;
export const E2E_WEB_PORT = 5174;
export const E2E_WEB_ORIGIN = `http://localhost:${E2E_WEB_PORT}`;

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: E2E_WEB_ORIGIN,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npx tsx src/server.ts',
      cwd: resolve(repoRoot, 'apps/api'),
      url: `http://127.0.0.1:${E2E_API_PORT}/api/health`,
      reuseExistingServer: false,
      env: {
        DATABASE_URL: testDatabaseUrl,
        API_PORT: String(E2E_API_PORT),
        API_HOST: '127.0.0.1',
        WEB_ORIGIN: E2E_WEB_ORIGIN,
        DEMO_AUTH_ENABLED: 'true',
        SESSION_SECRET: 'e2e-only-session-secret-0123456789abcdef',
        NODE_ENV: 'test',
      },
    },
    {
      command: `npx vite --port ${E2E_WEB_PORT} --strictPort`,
      cwd: resolve(repoRoot, 'apps/web'),
      url: E2E_WEB_ORIGIN,
      reuseExistingServer: false,
      env: { VITE_API_PROXY_TARGET: `http://127.0.0.1:${E2E_API_PORT}` },
    },
  ],
});
