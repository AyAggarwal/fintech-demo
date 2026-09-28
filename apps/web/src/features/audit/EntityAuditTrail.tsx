import { useQuery } from '@tanstack/react-query';
import type { AuditEntityType } from '@fintech-demo/contracts';
import { QueryState } from '../../shared/components/index.js';
import { auditQueryKeys, fetchAuditEvents } from './api.js';
import { AuditEventCard } from './AuditEventCard.js';

/** Audit events for one entity; embedded in detail panels of other features. */
export function EntityAuditTrail({ entityType, entityId }: { entityType: AuditEntityType; entityId: string }) {
  const query = useQuery({
    queryKey: auditQueryKeys.list({ entityType, entityId }),
    queryFn: () => fetchAuditEvents({ entityType, entityId }),
  });

  return (
    <QueryState isLoading={query.isPending} error={query.error} data={query.data} loadingMessage="Loading audit trail…">
      {(events) =>
        events.length === 0 ? (
          <div className="muted" data-testid="entity-audit-empty">No audit events for this record yet.</div>
        ) : (
          <div className="stack" data-testid="entity-audit-trail">
            {events.map((event) => (
              <AuditEventCard key={event.id} event={event} />
            ))}
          </div>
        )
      }
    </QueryState>
  );
}
