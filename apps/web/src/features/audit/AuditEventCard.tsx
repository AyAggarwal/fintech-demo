import type { AuditEvent } from '@fintech-demo/contracts';
import { Badge, KeyValueList } from '../../shared/components/index.js';
import { formatDateTime, formatEnumLabel, formatRole } from '../../shared/format.js';

export function AuditEventCard({ event, highlighted = false }: { event: AuditEvent; highlighted?: boolean }) {
  return (
    <div className="panel" data-testid="audit-event" data-event-id={event.id} style={highlighted ? { borderColor: 'var(--accent)' } : undefined}>
      <div className="panel-header">
        <h2 style={{ fontSize: 14 }}>
          {formatEnumLabel(event.action)} · {event.entityLabel}
        </h2>
        <Badge tone="accent">{formatEnumLabel(event.entityType)}</Badge>
      </div>
      <div className="panel-body">
        <KeyValueList
          items={[
            { label: 'When', value: formatDateTime(event.createdAt) },
            { label: 'Actor', value: `${event.actorName} (${formatRole(event.actorRole)})` },
            { label: 'Entity ID', value: <span className="mono">{event.entityId}</span> },
            { label: 'Reason', value: event.reason ?? <span className="muted">none supplied</span> },
            { label: 'Event ID', value: <span className="mono">{event.id}</span> },
          ]}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Before</div>
            <pre className="json">{JSON.stringify(event.before, null, 2)}</pre>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>After</div>
            <pre className="json">{JSON.stringify(event.after, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
