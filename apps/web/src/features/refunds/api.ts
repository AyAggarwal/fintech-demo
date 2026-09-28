import { refundDecisionResponseSchema, refundDetailSchema, refundListResponseSchema } from '@fintech-demo/contracts';
import type { DecisionRequest, RefundDecisionResponse, RefundDetail, RefundListQuery, RefundSummary } from '@fintech-demo/contracts';
import { apiRequest, makeQueryKeys } from '../../shared/api/index.js';

export const refundQueryKeys = makeQueryKeys<RefundListQuery>('refunds');

export async function fetchRefunds(query: RefundListQuery): Promise<RefundSummary[]> {
  const response = await apiRequest('/api/refunds', refundListResponseSchema, { query });
  return response.items;
}

export function fetchRefund(id: string): Promise<RefundDetail> {
  return apiRequest(`/api/refunds/${encodeURIComponent(id)}`, refundDetailSchema);
}

export function decideRefund(id: string, request: DecisionRequest): Promise<RefundDecisionResponse> {
  return apiRequest(`/api/refunds/${encodeURIComponent(id)}/decision`, refundDecisionResponseSchema, {
    method: 'POST',
    body: request,
  });
}
