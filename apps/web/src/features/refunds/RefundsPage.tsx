import { useQuery } from '@tanstack/react-query';
import { refundStatusSchema } from '@fintech-demo/contracts';
import type { RefundStatus, RefundSummary } from '@fintech-demo/contracts';
import { DataTable, PageHeader, Panel, QueryState, SearchInput, StatusBadge } from '../../shared/components/index.js';
import type { Column } from '../../shared/components/index.js';
import { formatDateTime, formatMoney } from '../../shared/format.js';
import { useUrlEnumParam, useUrlTextParam } from '../../shared/hooks/index.js';
import { fetchRefunds, refundQueryKeys } from './api.js';
import { RefundDetailPanel } from './RefundDetailPanel.js';

const columns: Column<RefundSummary>[] = [
  { header: 'Reference', render: (r) => <strong>{r.reference}</strong> },
  { header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
  { header: 'Customer', render: (r) => r.customerLabel },
  { header: 'Reason', render: (r) => r.requestReason },
  { header: 'Amount', render: (r) => formatMoney(r.amountCents, r.currency), numeric: true },
  { header: 'Requested', render: (r) => formatDateTime(r.createdAt) },
];

export function RefundsPage() {
  const [status, setStatus] = useUrlEnumParam<RefundStatus>('status', refundStatusSchema.options);
  const [search, setSearch] = useUrlTextParam('search');
  const [selectedId, setSelectedId] = useUrlTextParam('selected');

  const list = useQuery({
    queryKey: refundQueryKeys.list({ status, search }),
    queryFn: () => fetchRefunds({ status, search }),
  });

  const select = (refund: RefundSummary) => {
    setSelectedId(refund.id);
  };

  return (
    <>
      <PageHeader title="Refunds" description="Review each request against its synthetic transaction before recording a decision." />
      <div className="split">
        <Panel
          title="Decision queue"
          actions={
            <div className="filters">
              <label>
                Status
                <select value={status ?? ''} onChange={(e) => { setStatus(e.target.value); }} data-testid="refund-status-filter">
                  <option value="">All</option>
                  {refundStatusSchema.options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                Search
                <SearchInput value={search} onCommit={setSearch} placeholder="Reference or customer" testId="refund-search" />
              </label>
            </div>
          }
        >
          <QueryState isLoading={list.isPending} error={list.error} data={list.data} loadingMessage="Loading refunds…">
            {(refunds) => (
              <DataTable
                columns={columns}
                rows={refunds}
                rowKey={(r) => r.id}
                selectedKey={selectedId ?? null}
                onSelect={select}
                emptyMessage="No refunds match these filters."
                testId="refunds-table"
              />
            )}
          </QueryState>
        </Panel>
        {selectedId ? <RefundDetailPanel refundId={selectedId} /> : (
          <Panel title="Review a request">
            <div className="empty-workspace">
              <span className="empty-workspace-mark">RF</span>
              <strong>Start with a refund in the queue</strong>
              <span>Compare the request amount and reason with the synthetic transaction, then record a simulated decision.</span>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
