import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolveLocalDevEndpoints } from '@fintech-demo/contracts';

// Same precedence as the API's `dotenv -o`: the repo .env wins over shell variables.
const rootEnvFile = resolve(import.meta.dirname, '../../.env');
const rootEnv = existsSync(rootEnvFile) ? parseEnv(readFileSync(rootEnvFile, 'utf8')) : {};
const endpoints = resolveLocalDevEndpoints({ ...process.env, ...rootEnv });
const apiTarget = process.env.VITE_API_PROXY_TARGET ?? endpoints.apiUrl;

export default defineConfig({
  plugins: [react()],
  server: {
    port: endpoints.webPort,
    strictPort: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: false },
    },
  },
});
