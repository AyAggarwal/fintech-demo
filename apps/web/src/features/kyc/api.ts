import { kycCaseDetailSchema, kycDecisionResponseSchema, kycListResponseSchema } from '@fintech-demo/contracts';
import type { DecisionRequest, KycCaseDetail, KycCaseSummary, KycDecisionResponse, KycListQuery } from '@fintech-demo/contracts';
import { apiRequest, makeQueryKeys } from '../../shared/api/index.js';

export const kycQueryKeys = makeQueryKeys<KycListQuery>('kyc');

export async function fetchKycCases(query: KycListQuery): Promise<KycCaseSummary[]> {
  const response = await apiRequest('/api/kyc-cases', kycListResponseSchema, { query });
  return response.items;
}

export function fetchKycCase(id: string): Promise<KycCaseDetail> {
  return apiRequest(`/api/kyc-cases/${encodeURIComponent(id)}`, kycCaseDetailSchema);
}

export function decideKycCase(id: string, request: DecisionRequest): Promise<KycDecisionResponse> {
  return apiRequest(`/api/kyc-cases/${encodeURIComponent(id)}/decision`, kycDecisionResponseSchema, {
    method: 'POST',
    body: request,
  });
}
