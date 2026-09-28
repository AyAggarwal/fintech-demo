/** Local-development endpoints used when `.env` does not set them. */
export const LOCAL_DEV_DEFAULTS = {
  API_HOST: '127.0.0.1',
  API_PORT: 3001,
  WEB_ORIGIN: 'http://localhost:5173',
} as const;

export interface LocalDevEndpoints {
  apiHost: string;
  apiPort: number;
  /** Base URL the Vite dev server proxies `/api` to. */
  apiUrl: string;
  webOrigin: string;
  webPort: number;
}

/** Resolves API_HOST / API_PORT / WEB_ORIGIN from `env`, falling back to {@link LOCAL_DEV_DEFAULTS}. */
export function resolveLocalDevEndpoints(env: Readonly<Record<string, string | undefined>>): LocalDevEndpoints {
  const apiHost = env.API_HOST ?? LOCAL_DEV_DEFAULTS.API_HOST;
  const apiPort = env.API_PORT === undefined ? LOCAL_DEV_DEFAULTS.API_PORT : Number(env.API_PORT);
  const webOrigin = env.WEB_ORIGIN ?? LOCAL_DEV_DEFAULTS.WEB_ORIGIN;
  const web = new URL(webOrigin);
  const webPort = web.port !== '' ? Number(web.port) : web.protocol === 'https:' ? 443 : 80;
  return { apiHost, apiPort, apiUrl: `http://${apiHost}:${apiPort}`, webOrigin, webPort };
}
