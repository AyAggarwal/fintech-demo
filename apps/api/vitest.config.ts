import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

// The repo .env wins over shell variables so a global DATABASE_URL cannot redirect the tests.
const rootEnvFile = resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnvFile)) {
  Object.assign(process.env, parseEnv(readFileSync(rootEnvFile, 'utf8')));
}

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Every file shares one integration-test database, so files run one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
