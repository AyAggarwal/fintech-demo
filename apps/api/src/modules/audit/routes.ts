import type { FastifyInstance } from 'fastify';
import { auditListQuerySchema } from '@fintech-demo/contracts';
import type { AuditListResponse } from '@fintech-demo/contracts';
import { requireActor } from '../../platform/auth/index.js';
import { requirePermission } from '../../platform/authorization/index.js';
import type { DatabaseClient } from '../../platform/database/index.js';
import { parseInput } from '../../platform/http/index.js';
import { listAuditEvents } from './audit-query.js';

/** Read-only. There are intentionally no endpoints to edit or delete audit events. */
export function registerAuditRoutes(app: FastifyInstance, db: DatabaseClient): void {
  app.get('/api/audit-events', async (request): Promise<AuditListResponse> => {
    const actor = requireActor(request);
    requirePermission(actor, 'audit:read');
    const query = parseInput(auditListQuerySchema, request.query, 'query');
    return { items: await listAuditEvents(db, query) };
  });
}
