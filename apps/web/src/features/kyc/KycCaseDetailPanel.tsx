import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Decision, PrivilegedActionInput } from '@fintech-demo/contracts';
import { useSession } from '../../shared/auth/index.js';
import { ActionResult, DecisionButtons, KeyValueList, Panel, QueryState, StatusBadge } from '../../shared/components/index.js';
import type { ActionResultInfo } from '../../shared/components/index.js';
import { formatDateTime, formatEnumLabel } from '../../shared/format.js';
import { EntityAuditTrail, auditQueryKeys } from '../audit/index.js';
import { decideKycCase, fetchKycCase, kycQueryKeys } from './api.js';

export function KycCaseDetailPanel({ caseId }: { caseId: string }) {
  const { hasPermission } = useSession();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ActionResultInfo | null>(null);

  const detail = useQuery({ queryKey: kycQueryKeys.detail(caseId), queryFn: () => fetchKycCase(caseId) });

  const decide = useMutation({
    mutationFn: ({ decision, input }: { decision: Decision; input: PrivilegedActionInput }) =>
      decideKycCase(caseId, { decision, ...input }),
    onSuccess: async (response) => {
      setResult({ message: `Recorded ${response.decision.toLowerCase()} decision for ${response.kycCase.reference}.`, auditEventId: response.auditEventId });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: kycQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: auditQueryKeys.all }),
      ]);
    },
  });

  return (
    <Panel title="Case detail">
      <QueryState isLoading={detail.isPending} error={detail.error} data={detail.data} loadingMessage="Loading case…">
        {(kycCase) => (
          <>
            <KeyValueList
              items={[
                { label: 'Reference', value: <strong data-testid="kyc-reference">{kycCase.reference}</strong> },
                { label: 'Status', value: <span data-testid="kyc-status"><StatusBadge value={kycCase.status} /></span> },
                { label: 'Applicant', value: kycCase.applicantLabel },
                { label: 'Account type', value: formatEnumLabel(kycCase.accountType) },
                { label: 'Risk level', value: <StatusBadge value={kycCase.riskLevel} /> },
                { label: 'Opened', value: formatDateTime(kycCase.createdAt) },
                { label: 'Decided', value: formatDateTime(kycCase.decidedAt) },
                { label: 'Decided by', value: kycCase.decidedByName ?? '—' },
                { label: 'Decision reason', value: kycCase.decisionReason ?? '—' },
              ]}
            />
            <h3 style={{ margin: '4px 0 0', fontSize: 13 }}>Fictional risk flags</h3>
            {kycCase.riskFlags.length === 0 ? (
              <div className="muted">No risk flags on this case.</div>
            ) : (
              <ul className="flags">
                {kycCase.riskFlags.map((flag) => (
                  <li key={flag.code}>
                    <span>
                      <span className="mono">{flag.code}</span> · {flag.label}
                    </span>
                    <StatusBadge value={flag.severity} />
                  </li>
                ))}
              </ul>
            )}
            <div className="muted" style={{ fontSize: 12 }}>Analyst notes: {kycCase.notes}</div>
            <ActionResult result={result} />
            <DecisionButtons
              entityLabel={kycCase.reference}
              isPending={kycCase.status === 'PENDING'}
              canDecide={hasPermission('kyc:decide')}
              onDecide={(decision, input) => decide.mutateAsync({ decision, input }).then(() => undefined)}
            />
            <h3 style={{ margin: '8px 0 0', fontSize: 13 }}>Audit trail</h3>
            <EntityAuditTrail entityType="KYC_CASE" entityId={kycCase.id} />
          </>
        )}
      </QueryState>
    </Panel>
  );
}
