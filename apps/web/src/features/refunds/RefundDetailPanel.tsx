import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Decision, PrivilegedActionInput } from '@fintech-demo/contracts';
import { useSession } from '../../shared/auth/index.js';
import { ActionResult, DecisionButtons, KeyValueList, Panel, QueryState, StatusBadge } from '../../shared/components/index.js';
import type { ActionResultInfo } from '../../shared/components/index.js';
import { formatDateTime, formatMoney } from '../../shared/format.js';
import { EntityAuditTrail, auditQueryKeys } from '../audit/index.js';
import { decideRefund, fetchRefund, refundQueryKeys } from './api.js';

export function RefundDetailPanel({ refundId }: { refundId: string }) {
  const { hasPermission } = useSession();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ActionResultInfo | null>(null);

  const detail = useQuery({ queryKey: refundQueryKeys.detail(refundId), queryFn: () => fetchRefund(refundId) });

  const decide = useMutation({
    mutationFn: ({ decision, input }: { decision: Decision; input: PrivilegedActionInput }) =>
      decideRefund(refundId, { decision, ...input }),
    onSuccess: async (response) => {
      setResult({ message: `Recorded ${response.decision.toLowerCase()} decision for ${response.refund.reference}.`, auditEventId: response.auditEventId });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: refundQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: auditQueryKeys.all }),
      ]);
    },
  });

  return (
    <Panel title="Refund detail">
      <QueryState isLoading={detail.isPending} error={detail.error} data={detail.data} loadingMessage="Loading refund…">
        {(refund) => (
          <>
            <KeyValueList
              items={[
                { label: 'Reference', value: <strong data-testid="refund-reference">{refund.reference}</strong> },
                { label: 'Status', value: <span data-testid="refund-status"><StatusBadge value={refund.status} /></span> },
                { label: 'Amount', value: formatMoney(refund.amountCents, refund.currency) },
                { label: 'Customer', value: refund.customerLabel },
                { label: 'Request reason', value: refund.requestReason },
                { label: 'Requested', value: formatDateTime(refund.createdAt) },
                { label: 'Decided', value: formatDateTime(refund.decidedAt) },
                { label: 'Decided by', value: refund.decidedByName ?? '—' },
                { label: 'Decision reason', value: refund.decisionReason ?? '—' },
              ]}
            />
            <h3 style={{ margin: '4px 0 0', fontSize: 13 }}>Synthetic transaction</h3>
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
            <h3 style={{ margin: '8px 0 0', fontSize: 13 }}>Audit trail</h3>
            <EntityAuditTrail entityType="REFUND" entityId={refund.id} />
          </>
        )}
      </QueryState>
    </Panel>
  );
}
