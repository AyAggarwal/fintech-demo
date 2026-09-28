import type { FastifyInstance } from 'fastify';
import { auditListQuerySchema } from '@fintech-demo/contracts';
import type { AuditEvent, AuditListResponse } from '@fintech-demo/contracts';
import { requireActor } from '../../platform/auth/index.js';
import { requirePermission } from '../../platform/authorization/index.js';
import type { DatabaseClient } from '../../platform/database/index.js';
import { NotFoundError } from '../../platform/errors/index.js';
import { entityIdParamsSchema, parseInput } from '../../platform/http/index.js';
import { findAuditEvent, listAuditEvents } from './audit-query.js';

/** Read-only. There are intentionally no endpoints to edit or delete audit events. */
export function registerAuditRoutes(app: FastifyInstance, db: DatabaseClient): void {
  app.get('/api/audit-events', async (request): Promise<AuditListResponse> => {
    const actor = requireActor(request);
    requirePermission(actor, 'audit:read');
    const query = parseInput(auditListQuerySchema, request.query, 'query');
    return { items: await listAuditEvents(db, query) };
  });

  app.get('/api/audit-events/:id', async (request): Promise<AuditEvent> => {
    const actor = requireActor(request);
    requirePermission(actor, 'audit:read');
    const { id } = parseInput(entityIdParamsSchema, request.params, 'path parameters');
    const event = await findAuditEvent(db, id);
    if (!event) {
      throw new NotFoundError('Audit event', id);
    }
    return event;
  });
}
