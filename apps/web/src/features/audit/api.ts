import { auditEventSchema, auditListResponseSchema } from '@fintech-demo/contracts';
import type { AuditEvent, AuditListQuery } from '@fintech-demo/contracts';
import { apiRequest } from '../../shared/api/index.js';

export const auditQueryKeys = {
  all: ['audit'] as const,
  list: (query: Partial<AuditListQuery>) => ['audit', 'list', query] as const,
  detail: (id: string) => ['audit', 'detail', id] as const,
};

export async function fetchAuditEvents(query: Partial<AuditListQuery>): Promise<AuditEvent[]> {
  const response = await apiRequest('/api/audit-events', auditListResponseSchema, { query });
  return response.items;
}

export function fetchAuditEvent(id: string): Promise<AuditEvent> {
  return apiRequest(`/api/audit-events/${encodeURIComponent(id)}`, auditEventSchema);
}
