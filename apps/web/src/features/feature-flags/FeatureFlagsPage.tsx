import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FeatureFlag, PrivilegedActionInput } from '@fintech-demo/contracts';
import { useSession } from '../../shared/auth/index.js';
import { ActionDialog, ActionResult, Alert, Badge, DataTable, PageHeader, Panel, QueryState } from '../../shared/components/index.js';
import type { ActionResultInfo, Column } from '../../shared/components/index.js';
import { formatDateTime } from '../../shared/format.js';
import { EntityAuditTrail, auditQueryKeys } from '../audit/index.js';
import { featureFlagQueryKeys, fetchFeatureFlags, updateFeatureFlag } from './api.js';

export function FeatureFlagsPage() {
  const { hasPermission } = useSession();
  const canWrite = hasPermission('feature-flags:write');
  const queryClient = useQueryClient();
  const [pendingToggle, setPendingToggle] = useState<FeatureFlag | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResultInfo | null>(null);

  const list = useQuery({ queryKey: featureFlagQueryKeys.all, queryFn: fetchFeatureFlags });

  const toggle = useMutation({
    mutationFn: ({ flag, input }: { flag: FeatureFlag; input: PrivilegedActionInput }) =>
      updateFeatureFlag(flag.id, { enabled: !flag.enabled, ...input }),
    onSuccess: async (response) => {
      setResult({ message: `${response.flag.key} is now ${response.flag.enabled ? 'enabled' : 'disabled'}.`, auditEventId: response.auditEventId });
      setSelectedId(response.flag.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: featureFlagQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: auditQueryKeys.all }),
      ]);
    },
  });

  const columns: Column<FeatureFlag>[] = [
    { header: 'Key', render: (f) => <span className="mono" data-testid={`flag-key-${f.key}`}>{f.key}</span> },
    { header: 'Description', render: (f) => f.description },
    {
      header: 'State',
      render: (f) => (
        <span data-testid={`flag-state-${f.key}`}>
          <Badge tone={f.enabled ? 'success' : 'neutral'}>{f.enabled ? 'ENABLED' : 'DISABLED'}</Badge>
        </span>
      ),
    },
    { header: 'Last change', render: (f) => `${formatDateTime(f.updatedAt)}${f.updatedByName ? ` · ${f.updatedByName}` : ''}` },
    {
      header: 'Action',
      render: (f) => (
        <button
          type="button"
          className="btn small"
          disabled={!canWrite}
          title={canWrite ? undefined : 'Administrator role required'}
          onClick={(event) => {
            event.stopPropagation();
            setPendingToggle(f);
          }}
          data-testid={`flag-toggle-${f.key}`}
        >
          {f.enabled ? 'Disable' : 'Enable'}
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Feature flags" description="Runtime flags for internal tooling. Writes are administrator-only and enforced by the API." />
      {canWrite ? null : (
        <Alert kind="info" testId="flags-readonly-notice">
          Your role can view flags but cannot change them. The API rejects writes from non-administrators regardless of the UI.
        </Alert>
      )}
      <ActionResult result={result} />
      <div className="split">
        <Panel title="Flags">
          <QueryState isLoading={list.isPending} error={list.error} data={list.data} loadingMessage="Loading flags…">
            {(flags) => (
              <DataTable
                columns={columns}
                rows={flags}
                rowKey={(f) => f.id}
                selectedKey={selectedId}
                onSelect={(f) => { setSelectedId(f.id); }}
                emptyMessage="No flags are defined."
                testId="flags-table"
              />
            )}
          </QueryState>
        </Panel>
        <Panel title="Audit trail">
          {selectedId ? <EntityAuditTrail entityType="FEATURE_FLAG" entityId={selectedId} /> : <div className="state">Select a flag to see its audit events.</div>}
        </Panel>
      </div>
      {pendingToggle ? (
        <ActionDialog
          title={`${pendingToggle.enabled ? 'Disable' : 'Enable'} ${pendingToggle.key}`}
          description="This changes the stored flag value and records an audit event in the same transaction."
          confirmLabel={pendingToggle.enabled ? 'Disable flag' : 'Enable flag'}
          tone={pendingToggle.enabled ? 'danger' : 'primary'}
          onConfirm={(input) => toggle.mutateAsync({ flag: pendingToggle, input }).then(() => undefined)}
          onClose={() => { setPendingToggle(null); }}
        />
      ) : null}
    </>
  );
}
