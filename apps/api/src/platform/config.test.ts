import { LOCAL_DEV_DEFAULTS, resolveLocalDevEndpoints } from '@fintech-demo/contracts';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const REQUIRED_ENV = {
  DATABASE_URL: 'postgresql://unused',
  SESSION_SECRET: 'config-test-secret-0123456789abcdef',
};

describe('local-dev endpoint defaults', () => {
  it('are the defaults loadConfig applies when .env leaves them unset', () => {
    const config = loadConfig(REQUIRED_ENV);
    expect(config).toMatchObject({ port: 3001, host: '127.0.0.1', webOrigin: 'http://localhost:5173' });
    expect(config).toMatchObject({
      port: LOCAL_DEV_DEFAULTS.API_PORT,
      host: LOCAL_DEV_DEFAULTS.API_HOST,
      webOrigin: LOCAL_DEV_DEFAULTS.WEB_ORIGIN,
    });
  });

  it('resolve to the same API address and web port the dev servers use', () => {
    expect(resolveLocalDevEndpoints({})).toEqual({
      apiHost: '127.0.0.1',
      apiPort: 3001,
      apiUrl: 'http://127.0.0.1:3001',
      webOrigin: 'http://localhost:5173',
      webPort: 5173,
    });
  });

  it('follow overrides so the web proxy and the API agree on the port', () => {
    const env = { ...REQUIRED_ENV, API_PORT: '3002', API_HOST: 'localhost', WEB_ORIGIN: 'http://localhost:5180' };
    const config = loadConfig(env);
    const endpoints = resolveLocalDevEndpoints(env);
    expect(endpoints.apiUrl).toBe(`http://${config.host}:${config.port}`);
    expect(endpoints.webOrigin).toBe(config.webOrigin);
    expect(endpoints.webPort).toBe(5180);
  });
});
