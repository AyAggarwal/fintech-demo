import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const rootEnvFile = resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Every file shares one integration-test database, so files run one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
