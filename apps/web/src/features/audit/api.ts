import { auditEventSchema, auditListResponseSchema } from '@fintech-demo/contracts';
import type { AuditEvent, AuditListQuery } from '@fintech-demo/contracts';
import { apiRequest, makeQueryKeys } from '../../shared/api/index.js';

export const auditQueryKeys = makeQueryKeys<Partial<AuditListQuery>>('audit');

export async function fetchAuditEvents(query: Partial<AuditListQuery>): Promise<AuditEvent[]> {
  const response = await apiRequest('/api/audit-events', auditListResponseSchema, { query });
  return response.items;
}

export function fetchAuditEvent(id: string): Promise<AuditEvent> {
  return apiRequest(`/api/audit-events/${encodeURIComponent(id)}`, auditEventSchema);
}
