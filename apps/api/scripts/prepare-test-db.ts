import { execFileSync } from 'node:child_process';

/**
 * Applies committed migrations to the integration-test database (TEST_DATABASE_URL).
 * Tests re-seed the fixtures themselves, so this only has to make the schema current.
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is not set; copy .env.example to .env at the repository root');
}

execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
});
