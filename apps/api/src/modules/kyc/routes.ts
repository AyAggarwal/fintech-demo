import type { FastifyInstance } from 'fastify';
import { decisionRequestSchema, kycListQuerySchema } from '@fintech-demo/contracts';
import type { KycCaseDetail, KycDecisionResponse, KycListResponse } from '@fintech-demo/contracts';
import { requireActor } from '../../platform/auth/index.js';
import { entityIdParamsSchema, parseInput } from '../../platform/http/index.js';
import type { KycService } from './kyc-service.js';

export function registerKycRoutes(app: FastifyInstance, service: KycService): void {
  app.get('/api/kyc-cases', async (request): Promise<KycListResponse> => {
    const actor = requireActor(request);
    const query = parseInput(kycListQuerySchema, request.query, 'query');
    return { items: await service.list(actor, query) };
  });

  app.get('/api/kyc-cases/:id', async (request): Promise<KycCaseDetail> => {
    const actor = requireActor(request);
    const { id } = parseInput(entityIdParamsSchema, request.params, 'path parameters');
    return service.get(actor, id);
  });

  app.post('/api/kyc-cases/:id/decision', async (request): Promise<KycDecisionResponse> => {
    const actor = requireActor(request);
    const { id } = parseInput(entityIdParamsSchema, request.params, 'path parameters');
    const body = parseInput(decisionRequestSchema, request.body, 'decision');
    return service.decide(actor, id, body);
  });
}
