import { useQuery } from '@tanstack/react-query';
import { auditActionSchema, auditEntityTypeSchema } from '@fintech-demo/contracts';
import type { AuditAction, AuditEntityType } from '@fintech-demo/contracts';
import { PageHeader, QueryState } from '../../shared/components/index.js';
import { formatEnumLabel } from '../../shared/format.js';
import { useUrlEnumParam, useUrlTextParam } from '../../shared/hooks/index.js';
import { auditQueryKeys, fetchAuditEvent, fetchAuditEvents } from './api.js';
import { AuditEventCard } from './AuditEventCard.js';

const RESET_ON_FILTER = ['eventId'] as const;

export function AuditPage() {
  const [entityType, setEntityType] = useUrlEnumParam<AuditEntityType>('entityType', auditEntityTypeSchema.options, RESET_ON_FILTER);
  const [action, setAction] = useUrlEnumParam<AuditAction>('action', auditActionSchema.options, RESET_ON_FILTER);
  const [eventId] = useUrlTextParam('eventId');

  const listQuery = useQuery({
    queryKey: auditQueryKeys.list({ entityType, action }),
    queryFn: () => fetchAuditEvents({ entityType, action, limit: 100 }),
  });
  const highlightedQuery = useQuery({
    queryKey: auditQueryKeys.detail(eventId ?? ''),
    queryFn: () => fetchAuditEvent(eventId ?? ''),
    enabled: eventId !== undefined,
  });

  return (
    <>
      <PageHeader title="Audit" description="Application audit trail shared by refunds, KYC, and feature flags. Read-only." />
      <div className="filters">
        <label>
          Entity type
          <select value={entityType ?? ''} onChange={(e) => { setEntityType(e.target.value); }}>
            <option value="">All</option>
            {auditEntityTypeSchema.options.map((option) => (
              <option key={option} value={option}>{formatEnumLabel(option)}</option>
            ))}
          </select>
        </label>
        <label>
          Action
          <select value={action ?? ''} onChange={(e) => { setAction(e.target.value); }}>
            <option value="">All</option>
            {auditActionSchema.options.map((option) => (
              <option key={option} value={option}>{formatEnumLabel(option)}</option>
            ))}
          </select>
        </label>
      </div>

      {eventId ? (
        <QueryState isLoading={highlightedQuery.isPending} error={highlightedQuery.error} data={highlightedQuery.data} loadingMessage="Loading event…">
          {(event) => <AuditEventCard event={event} highlighted />}
        </QueryState>
      ) : null}

      <QueryState isLoading={listQuery.isPending} error={listQuery.error} data={listQuery.data} loadingMessage="Loading audit events…">
        {(events) =>
          events.length === 0 ? (
            <div className="state">No audit events match these filters.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="audit-list">
              {events
                .filter((event) => event.id !== eventId)
                .map((event) => (
                  <AuditEventCard key={event.id} event={event} />
                ))}
            </div>
          )
        }
      </QueryState>
    </>
  );
}
