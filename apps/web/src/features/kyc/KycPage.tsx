import { useQuery } from '@tanstack/react-query';
import { kycStatusSchema, riskLevelSchema } from '@fintech-demo/contracts';
import type { KycCaseSummary, KycStatus, RiskLevel } from '@fintech-demo/contracts';
import { PageHeader, Panel, QueryState, SearchInput, StatusBadge } from '../../shared/components/index.js';
import { formatEnumLabel } from '../../shared/format.js';
import { useUrlEnumParam, useUrlTextParam } from '../../shared/hooks/index.js';
import { fetchKycCases, kycQueryKeys } from './api.js';
import { KycCaseDetailPanel } from './KycCaseDetailPanel.js';

export function KycPage() {
  const [status, setStatus] = useUrlEnumParam<KycStatus>('status', kycStatusSchema.options);
  const [riskLevel, setRiskLevel] = useUrlEnumParam<RiskLevel>('riskLevel', riskLevelSchema.options);
  const [search, setSearch] = useUrlTextParam('search');
  const [selectedId, setSelectedId] = useUrlTextParam('selected');

  const overview = useQuery({
    queryKey: kycQueryKeys.list({}),
    queryFn: () => fetchKycCases({}),
  });
  const list = useQuery({
    queryKey: kycQueryKeys.list({ status, riskLevel, search }),
    queryFn: () => fetchKycCases({ status, riskLevel, search }),
  });

  const pending = overview.data?.filter((kycCase) => kycCase.status === 'PENDING') ?? [];

  return (
    <>
      <PageHeader title="KYC" description="Triage fictional onboarding cases by risk, then inspect their synthetic signals." />
      <div className="metric-strip kyc-metrics" aria-label="KYC queue overview">
        <div className="metric"><span>Open cases</span><strong>{overview.data ? pending.length : '—'}</strong><small>Awaiting a decision</small></div>
        <div className="metric"><span>High risk</span><strong>{overview.data ? pending.filter((item) => item.riskLevel === 'HIGH').length : '—'}</strong><small>Pending manual review</small></div>
        <div className="metric"><span>Flagged cases</span><strong>{overview.data ? pending.filter((item) => item.riskFlagCount > 0).length : '—'}</strong><small>With synthetic signals</small></div>
      </div>
      <div className="split kyc-layout">
        <Panel
          title="Risk review"
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
                <SearchInput value={search} onCommit={setSearch} placeholder="Reference or applicant" testId="kyc-search" />
              </label>
            </div>
          }
        >
          <QueryState isLoading={list.isPending} error={list.error} data={list.data} loadingMessage="Loading cases…">
            {(cases) => (
              cases.length === 0 ? <div className="state">No cases match these filters.</div> : (
                <div className="case-list" data-testid="kyc-table">
                  {cases.map((kycCase: KycCaseSummary) => (
                    <button
                      key={kycCase.id}
                      type="button"
                      className={`case-item risk-${kycCase.riskLevel.toLowerCase()}${selectedId === kycCase.id ? ' selected' : ''}`}
                      onClick={() => { setSelectedId(kycCase.id); }}
                      aria-pressed={selectedId === kycCase.id}
                    >
                      <span className="case-item-top">
                        <span className="mono">{kycCase.reference}</span>
                        <StatusBadge value={kycCase.riskLevel} />
                      </span>
                      <strong>{kycCase.applicantLabel}</strong>
                      <span className="case-item-bottom">
                        {formatEnumLabel(kycCase.accountType)} · {kycCase.riskFlagCount} {kycCase.riskFlagCount === 1 ? 'signal' : 'signals'}
                        <StatusBadge value={kycCase.status} />
                      </span>
                    </button>
                  ))}
                </div>
              )
            )}
          </QueryState>
        </Panel>
        {selectedId ? <KycCaseDetailPanel caseId={selectedId} /> : (
          <Panel title="Review a case">
            <div className="empty-workspace">
              <span className="empty-workspace-mark">KYC</span>
              <strong>Select a case by risk level</strong>
              <span>Read its synthetic signals and analyst note before recording an onboarding decision.</span>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
