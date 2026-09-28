import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

export type DatabaseClient = PrismaClient;
/** The client handed to code running inside a transaction. */
export type TransactionClient = Prisma.TransactionClient;

export function createDatabaseClient(databaseUrl: string): DatabaseClient {
  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: ['warn', 'error'],
  });
}
