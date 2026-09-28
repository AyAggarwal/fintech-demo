import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_HOST: z.string().default('127.0.0.1'),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  DEMO_AUTH_ENABLED: z.enum(['true', 'false']).default('false'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export interface AppConfig {
  databaseUrl: string;
  port: number;
  host: string;
  webOrigin: string;
  demoAuthEnabled: boolean;
  sessionSecret: string;
  secureCookies: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const value = parsed.data;
  const demoAuthEnabled = value.DEMO_AUTH_ENABLED === 'true';
  if (demoAuthEnabled && value.NODE_ENV === 'production') {
    throw new Error('DEMO_AUTH_ENABLED=true is not allowed when NODE_ENV=production');
  }
  return {
    databaseUrl: value.DATABASE_URL,
    port: value.API_PORT,
    host: value.API_HOST,
    webOrigin: value.WEB_ORIGIN,
    demoAuthEnabled,
    sessionSecret: value.SESSION_SECRET,
    secureCookies: value.NODE_ENV === 'production',
  };
}
