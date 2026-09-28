import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { FeatureFlag, PrivilegedActionInput } from '@fintech-demo/contracts';
import { useSession } from '../../shared/auth/index.js';
import { ActionDialog, ActionResult, Alert, Badge, PageHeader, Panel, QueryState } from '../../shared/components/index.js';
import type { ActionResultInfo } from '../../shared/components/index.js';
import { formatDateTime } from '../../shared/format.js';
import { useUrlTextParam } from '../../shared/hooks/index.js';
import { EntityAuditTrail, useAuditedMutation } from '../audit/index.js';
import { featureFlagQueryKeys, fetchFeatureFlags, updateFeatureFlag } from './api.js';

export function FeatureFlagsPage() {
  const { hasPermission } = useSession();
  const canWrite = hasPermission('feature-flags:write');
  const [pendingToggle, setPendingToggle] = useState<FeatureFlag | null>(null);
  const [selectedId, setSelectedId] = useUrlTextParam('selected');
  const [result, setResult] = useState<ActionResultInfo | null>(null);

  const list = useQuery({ queryKey: featureFlagQueryKeys.all, queryFn: fetchFeatureFlags });
  const selected = list.data?.find((flag) => flag.id === selectedId);

  const toggle = useAuditedMutation({
    featureKey: featureFlagQueryKeys.all,
    mutationFn: ({ flag, input }: { flag: FeatureFlag; input: PrivilegedActionInput }) =>
      updateFeatureFlag(flag.id, { enabled: !flag.enabled, ...input }),
    onResult: (response) => {
      setResult({ message: `${response.flag.key} is now ${response.flag.enabled ? 'enabled' : 'disabled'}.`, auditEventId: response.auditEventId });
      setSelectedId(response.flag.id);
    },
  });

  return (
    <>
      <PageHeader title="Feature flags" description="Inspect stored switches and their history. Admin changes are recorded, not connected to live product behavior." />
      {canWrite ? null : (
        <Alert kind="info" testId="flags-readonly-notice">
          Your role can view flags but cannot change them. The API rejects writes from non-administrators regardless of the UI.
        </Alert>
      )}
      <ActionResult result={result} />
      <div className="split flags-layout">
        <Panel title="Configuration">
          <QueryState isLoading={list.isPending} error={list.error} data={list.data} loadingMessage="Loading flags…">
            {(flags) => (
              flags.length === 0 ? <div className="state">No flags are defined.</div> : (
                <div className="flag-grid" data-testid="flags-table">
                  {flags.map((flag) => (
                    <div key={flag.id} className={`flag-tile${selectedId === flag.id ? ' selected' : ''}`}>
                      <button
                        type="button"
                        className="flag-select"
                        onClick={() => { setSelectedId(flag.id); }}
                        aria-pressed={selectedId === flag.id}
                        aria-label={`Inspect ${flag.key}`}
                      >
                        <span className="flag-tile-top">
                          <span className="flag-domain">{flag.key.split('.')[0]}</span>
                          <span data-testid={`flag-state-${flag.key}`}>
                            <Badge tone={flag.enabled ? 'success' : 'neutral'}>{flag.enabled ? 'ENABLED' : 'DISABLED'}</Badge>
                          </span>
                        </span>
                        <strong className="mono" data-testid={`flag-key-${flag.key}`}>{flag.key}</strong>
                        <span className="flag-description">{flag.description}</span>
                      </button>
                      <div className="flag-tile-footer">
                        <span>{flag.updatedByName ? `Changed by ${flag.updatedByName}` : 'Seed value'}</span>
                        <button
                          type="button"
                          className="btn small"
                          disabled={!canWrite}
                          title={canWrite ? undefined : 'Administrator role required'}
                          onClick={() => { setPendingToggle(flag); }}
                          data-testid={`flag-toggle-${flag.key}`}
                        >
                          {flag.enabled ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </QueryState>
        </Panel>
        <Panel title="Flag inspection">
          {selected ? (
            <>
              <div className="detail-hero flag-hero">
                <span className="detail-eyebrow">Stored switch</span>
                <strong className="mono">{selected.key}</strong>
                <span>{selected.description}</span>
              </div>
              <div className="flag-state-row">
                <span>Current value</span>
                <Badge tone={selected.enabled ? 'success' : 'neutral'}>{selected.enabled ? 'ENABLED' : 'DISABLED'}</Badge>
              </div>
              <div className="flag-state-row">
                <span>Last changed</span>
                <strong>{formatDateTime(selected.updatedAt)}</strong>
              </div>
              <div className="flag-state-row">
                <span>Changed by</span>
                <strong>{selected.updatedByName ?? 'Seed data'}</strong>
              </div>
              <div className="review-note">Changing this value records an audit event. The demo does not connect these flags to running features.</div>
              <h3 className="detail-section-title">Change history</h3>
              <EntityAuditTrail entityType="FEATURE_FLAG" entityId={selected.id} />
            </>
          ) : (
            <div className="empty-workspace">
              <span className="empty-workspace-mark">ON</span>
              <strong>Select a flag</strong>
              <span>Inspect its stored value and audit history before making an admin-only change.</span>
            </div>
          )}
        </Panel>
      </div>
      {pendingToggle ? (
        <ActionDialog
          title={`${pendingToggle.enabled ? 'Disable' : 'Enable'} ${pendingToggle.key}`}
          description="This changes the stored demo value and records an audit event in the same transaction. It does not change live product behavior."
          confirmLabel={pendingToggle.enabled ? 'Disable flag' : 'Enable flag'}
          tone={pendingToggle.enabled ? 'danger' : 'primary'}
          onConfirm={(input) => toggle.mutateAsync({ flag: pendingToggle, input }).then(() => undefined)}
          onClose={() => { setPendingToggle(null); }}
        />
      ) : null}
    </>
  );
}
