import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuditPage } from '../features/audit/index.js';
import { FeatureFlagsPage } from '../features/feature-flags/index.js';
import { KycPage } from '../features/kyc/index.js';
import { RefundsPage } from '../features/refunds/index.js';
import { SessionProvider } from '../shared/auth/index.js';
import { Shell } from './Shell.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 5_000 },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<Navigate to="/refunds" replace />} />
              <Route path="/refunds" element={<RefundsPage />} />
              <Route path="/kyc" element={<KycPage />} />
              <Route path="/feature-flags" element={<FeatureFlagsPage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="*" element={<Navigate to="/refunds" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    </QueryClientProvider>
  );
}
