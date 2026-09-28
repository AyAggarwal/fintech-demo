import type { FastifyInstance } from 'fastify';
import { featureFlagUpdateRequestSchema } from '@fintech-demo/contracts';
import type { FeatureFlagListResponse, FeatureFlagUpdateResponse } from '@fintech-demo/contracts';
import { requireActor } from '../../platform/auth/index.js';
import { entityIdParamsSchema, parseInput } from '../../platform/http/index.js';
import type { FeatureFlagService } from './feature-flag-service.js';

export function registerFeatureFlagRoutes(app: FastifyInstance, service: FeatureFlagService): void {
  app.get('/api/feature-flags', async (request): Promise<FeatureFlagListResponse> => {
    const actor = requireActor(request);
    return { items: await service.list(actor) };
  });

  app.patch('/api/feature-flags/:id', async (request): Promise<FeatureFlagUpdateResponse> => {
    const actor = requireActor(request);
    const { id } = parseInput(entityIdParamsSchema, request.params, 'path parameters');
    const body = parseInput(featureFlagUpdateRequestSchema, request.body, 'feature flag update');
    return service.update(actor, id, body);
  });
}
