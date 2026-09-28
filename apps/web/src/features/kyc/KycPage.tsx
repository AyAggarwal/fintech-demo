import { useQuery } from '@tanstack/react-query';
import { kycStatusSchema, riskLevelSchema } from '@fintech-demo/contracts';
import type { KycCaseSummary, KycStatus, RiskLevel } from '@fintech-demo/contracts';
import { DataTable, PageHeader, Panel, QueryState, StatusBadge } from '../../shared/components/index.js';
import type { Column } from '../../shared/components/index.js';
import { formatDateTime, formatEnumLabel } from '../../shared/format.js';
import { useUrlEnumParam, useUrlTextParam } from '../../shared/hooks/index.js';
import { fetchKycCases, kycQueryKeys } from './api.js';
import { KycCaseDetailPanel } from './KycCaseDetailPanel.js';

const columns: Column<KycCaseSummary>[] = [
  { header: 'Reference', render: (c) => <strong>{c.reference}</strong> },
  { header: 'Status', render: (c) => <StatusBadge value={c.status} /> },
  { header: 'Applicant', render: (c) => c.applicantLabel },
  { header: 'Type', render: (c) => formatEnumLabel(c.accountType) },
  { header: 'Risk', render: (c) => <StatusBadge value={c.riskLevel} /> },
  { header: 'Flags', render: (c) => String(c.riskFlagCount), numeric: true },
  { header: 'Opened', render: (c) => formatDateTime(c.createdAt) },
];

export function KycPage() {
  const [status, setStatus] = useUrlEnumParam<KycStatus>('status', kycStatusSchema.options);
  const [riskLevel, setRiskLevel] = useUrlEnumParam<RiskLevel>('riskLevel', riskLevelSchema.options);
  const [search, setSearch] = useUrlTextParam('search');
  const [selectedId, setSelectedId] = useUrlTextParam('selected');

  const list = useQuery({
    queryKey: kycQueryKeys.list({ status, riskLevel, search }),
    queryFn: () => fetchKycCases({ status, riskLevel, search }),
  });

  return (
    <>
      <PageHeader title="KYC" description="Fictional onboarding cases with synthetic risk flags. Decisions are recorded, not verified against any vendor." />
      <div className="split">
        <Panel
          title="Cases"
          actions={
            <div className="filters">
              <label>
                Status
                <select value={status ?? ''} onChange={(e) => { setStatus(e.target.value); }} data-testid="kyc-status-filter">
                  <option value="">All</option>
                  {kycStatusSchema.options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                Risk
                <select value={riskLevel ?? ''} onChange={(e) => { setRiskLevel(e.target.value); }}>
                  <option value="">All</option>
                  {riskLevelSchema.options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                Search
                <input value={search ?? ''} onChange={(e) => { setSearch(e.target.value); }} placeholder="Reference or applicant" />
              </label>
            </div>
          }
        >
          <QueryState isLoading={list.isPending} error={list.error} data={list.data} loadingMessage="Loading cases…">
            {(cases) => (
              <DataTable
                columns={columns}
                rows={cases}
                rowKey={(c) => c.id}
                selectedKey={selectedId ?? null}
                onSelect={(c) => { setSelectedId(c.id); }}
                emptyMessage="No cases match these filters."
                testId="kyc-table"
              />
            )}
          </QueryState>
        </Panel>
        {selectedId ? <KycCaseDetailPanel caseId={selectedId} /> : <Panel title="Case detail"><div className="state">Select a case to inspect it.</div></Panel>}
      </div>
    </>
  );
}
