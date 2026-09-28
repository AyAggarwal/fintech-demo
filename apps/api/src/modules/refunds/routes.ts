import type { FastifyInstance } from 'fastify';
import { decisionRequestSchema, refundListQuerySchema } from '@fintech-demo/contracts';
import type { RefundDecisionResponse, RefundDetail, RefundListResponse } from '@fintech-demo/contracts';
import { requireActor } from '../../platform/auth/index.js';
import { entityIdParamsSchema, parseInput } from '../../platform/http/index.js';
import type { RefundService } from './refund-service.js';

export function registerRefundRoutes(app: FastifyInstance, service: RefundService): void {
  app.get('/api/refunds', async (request): Promise<RefundListResponse> => {
    const actor = requireActor(request);
    const query = parseInput(refundListQuerySchema, request.query, 'query');
    return { items: await service.list(actor, query) };
  });

  app.get('/api/refunds/:id', async (request): Promise<RefundDetail> => {
    const actor = requireActor(request);
    const { id } = parseInput(entityIdParamsSchema, request.params, 'path parameters');
    return service.get(actor, id);
  });

  app.post('/api/refunds/:id/decision', async (request): Promise<RefundDecisionResponse> => {
    const actor = requireActor(request);
    const { id } = parseInput(entityIdParamsSchema, request.params, 'path parameters');
    const body = parseInput(decisionRequestSchema, request.body, 'decision');
    return service.decide(actor, id, body);
  });
}
