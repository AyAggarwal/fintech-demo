import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/** Migrates and re-seeds the test database so every e2e run starts from the same fixtures. */
export default function globalSetup(): void {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL is not set');
  }
  const apiDir = resolve(import.meta.dirname, '../../apps/api');
  const env = { ...process.env, DATABASE_URL: testDatabaseUrl };
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], { cwd: apiDir, env, stdio: 'inherit' });
  execFileSync('npx', ['tsx', 'prisma/seed.ts'], { cwd: apiDir, env, stdio: 'inherit' });
}
