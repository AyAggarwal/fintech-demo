import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Decision, PrivilegedActionInput } from '@fintech-demo/contracts';
import { useSession } from '../../shared/auth/index.js';
import { ActionResult, DecisionButtons, KeyValueList, Panel, QueryState, StatusBadge } from '../../shared/components/index.js';
import type { ActionResultInfo } from '../../shared/components/index.js';
import { formatDateTime, formatMoney } from '../../shared/format.js';
import { EntityAuditTrail, useAuditedMutation } from '../audit/index.js';
import { decideRefund, fetchRefund, refundQueryKeys } from './api.js';

export function RefundDetailPanel({ refundId }: { refundId: string }) {
  const { hasPermission } = useSession();
  const [result, setResult] = useState<ActionResultInfo | null>(null);

  const detail = useQuery({ queryKey: refundQueryKeys.detail(refundId), queryFn: () => fetchRefund(refundId) });

  const decide = useAuditedMutation({
    featureKey: refundQueryKeys.all,
    mutationFn: ({ decision, input }: { decision: Decision; input: PrivilegedActionInput }) =>
      decideRefund(refundId, { decision, ...input }),
    onResult: (response) => {
      setResult({ message: `Recorded ${response.decision.toLowerCase()} decision for ${response.refund.reference}.`, auditEventId: response.auditEventId });
    },
  });

  return (
    <Panel title="Refund detail">
      <QueryState isLoading={detail.isPending} error={detail.error} data={detail.data} loadingMessage="Loading refund…">
        {(refund) => (
          <>
            <div className="detail-hero refund-hero">
              <span className="detail-eyebrow">Request {refund.reference}</span>
              <strong>{formatMoney(refund.amountCents, refund.currency)}</strong>
              <span>{refund.customerLabel} · {refund.requestReason}</span>
            </div>
            <div className="comparison">
              <div><span>Requested refund</span><strong>{formatMoney(refund.amountCents, refund.currency)}</strong></div>
              <div><span>Original transaction</span><strong>{formatMoney(refund.transaction.amountCents, refund.transaction.currency)}</strong></div>
            </div>
            <div className="review-note">
              {refund.amountCents === refund.transaction.amountCents
                ? 'Full transaction amount requested. Review the reason and merchant details before deciding.'
                : refund.amountCents < refund.transaction.amountCents
                  ? 'Partial transaction amount requested. Compare the request reason with the original charge.'
                  : 'Requested amount exceeds the transaction amount. Inspect this discrepancy before deciding.'}
            </div>
            <KeyValueList
              items={[
                { label: 'Reference', value: <strong data-testid="refund-reference">{refund.reference}</strong> },
                { label: 'Status', value: <span data-testid="refund-status"><StatusBadge value={refund.status} /></span> },
                { label: 'Customer', value: refund.customerLabel },
                { label: 'Requested', value: formatDateTime(refund.createdAt) },
                { label: 'Decided', value: formatDateTime(refund.decidedAt) },
                { label: 'Decided by', value: refund.decidedByName ?? '—' },
                { label: 'Decision reason', value: refund.decisionReason ?? '—' },
              ]}
            />
            <h3 className="detail-section-title">Synthetic transaction</h3>
            <KeyValueList
              items={[
                { label: 'Reference', value: <span className="mono">{refund.transaction.reference}</span> },
                { label: 'Merchant', value: refund.transaction.merchantName },
                { label: 'Amount', value: formatMoney(refund.transaction.amountCents, refund.transaction.currency) },
                { label: 'Card', value: `•••• ${refund.transaction.cardLast4}` },
                { label: 'Occurred', value: formatDateTime(refund.transaction.occurredAt) },
              ]}
            />
            <ActionResult result={result} />
            <DecisionButtons
              entityLabel={refund.reference}
              isPending={refund.status === 'PENDING'}
              canDecide={hasPermission('refunds:decide')}
              onDecide={(decision, input) => decide.mutateAsync({ decision, input }).then(() => undefined)}
            />
            <h3 className="detail-section-title">Decision history</h3>
            <EntityAuditTrail entityType="REFUND" entityId={refund.id} />
          </>
        )}
      </QueryState>
    </Panel>
  );
}
