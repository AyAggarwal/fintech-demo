import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Decision, PrivilegedActionInput } from '@fintech-demo/contracts';
import { useSession } from '../../shared/auth/index.js';
import { ActionResult, DecisionButtons, KeyValueList, Panel, QueryState, StatusBadge } from '../../shared/components/index.js';
import type { ActionResultInfo } from '../../shared/components/index.js';
import { formatDateTime, formatEnumLabel } from '../../shared/format.js';
import { EntityAuditTrail, useAuditedMutation } from '../audit/index.js';
import { decideKycCase, fetchKycCase, kycQueryKeys } from './api.js';

export function KycCaseDetailPanel({ caseId }: { caseId: string }) {
  const { hasPermission } = useSession();
  const [result, setResult] = useState<ActionResultInfo | null>(null);

  const detail = useQuery({ queryKey: kycQueryKeys.detail(caseId), queryFn: () => fetchKycCase(caseId) });

  const decide = useAuditedMutation({
    featureKey: kycQueryKeys.all,
    mutationFn: ({ decision, input }: { decision: Decision; input: PrivilegedActionInput }) =>
      decideKycCase(caseId, { decision, ...input }),
    onResult: (response) => {
      setResult({ message: `Recorded ${response.decision.toLowerCase()} decision for ${response.kycCase.reference}.`, auditEventId: response.auditEventId });
    },
  });

  return (
    <Panel title="Case detail">
      <QueryState isLoading={detail.isPending} error={detail.error} data={detail.data} loadingMessage="Loading case…">
        {(kycCase) => (
          <>
            <div className={`detail-hero kyc-hero risk-${kycCase.riskLevel.toLowerCase()}`}>
              <span className="detail-eyebrow">{kycCase.reference} · {formatEnumLabel(kycCase.accountType)}</span>
              <strong>{kycCase.applicantLabel}</strong>
              <span>{kycCase.riskFlagCount} synthetic {kycCase.riskFlagCount === 1 ? 'signal' : 'signals'} to review</span>
            </div>
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
            <h3 className="detail-section-title">Synthetic risk signals</h3>
            {kycCase.riskFlags.length === 0 ? (
              <div className="review-note">No risk flags on this case. Review the analyst note before deciding.</div>
            ) : (
              <ul className="risk-signals">
                {kycCase.riskFlags.map((flag) => (
                  <li key={flag.code} className={`risk-${flag.severity.toLowerCase()}`}>
                    <span><span className="mono">{flag.code}</span><strong>{flag.label}</strong></span>
                    <StatusBadge value={flag.severity} />
                  </li>
                ))}
              </ul>
            )}
            <div className="analyst-note"><span>ANALYST NOTE</span><p>{kycCase.notes}</p></div>
            <ActionResult result={result} />
            <DecisionButtons
              entityLabel={kycCase.reference}
              isPending={kycCase.status === 'PENDING'}
              canDecide={hasPermission('kyc:decide')}
              onDecide={(decision, input) => decide.mutateAsync({ decision, input }).then(() => undefined)}
            />
            <h3 className="detail-section-title">Decision history</h3>
            <EntityAuditTrail entityType="KYC_CASE" entityId={kycCase.id} />
          </>
        )}
      </QueryState>
    </Panel>
  );
}
