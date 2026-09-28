import { featureFlagListResponseSchema, featureFlagUpdateResponseSchema } from '@fintech-demo/contracts';
import type { FeatureFlag, FeatureFlagUpdateRequest, FeatureFlagUpdateResponse } from '@fintech-demo/contracts';
import { apiRequest } from '../../shared/api/index.js';

export const featureFlagQueryKeys = {
  all: ['feature-flags'] as const,
};

export async function fetchFeatureFlags(): Promise<FeatureFlag[]> {
  const response = await apiRequest('/api/feature-flags', featureFlagListResponseSchema);
  return response.items;
}

export function updateFeatureFlag(id: string, request: FeatureFlagUpdateRequest): Promise<FeatureFlagUpdateResponse> {
  return apiRequest(`/api/feature-flags/${encodeURIComponent(id)}`, featureFlagUpdateResponseSchema, {
    method: 'PATCH',
    body: request,
  });
}
