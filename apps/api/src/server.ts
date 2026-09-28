import { buildApp } from './app.js';
import { loadConfig } from './platform/config.js';
import { createDatabaseClient } from './platform/database/index.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const db = createDatabaseClient(config.databaseUrl);
  const app = await buildApp({ config, db, logger: true });

  const shutdown = async (): Promise<void> => {
    await app.close();
    await db.$disconnect();
  };
  process.on('SIGINT', () => void shutdown().finally(() => process.exit(0)));
  process.on('SIGTERM', () => void shutdown().finally(() => process.exit(0)));

  await app.listen({ port: config.port, host: config.host });
  if (config.demoAuthEnabled) {
    app.log.warn('DEMO MODE authentication is enabled. Do not use this configuration outside local demos.');
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
