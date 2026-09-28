import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router-dom';
import { DemoSignIn, useSession } from '../shared/auth/index.js';
import { Alert } from '../shared/components/index.js';
import { formatRole } from '../shared/format.js';

const NAV_ITEMS = [
  { to: '/refunds', label: 'Refunds' },
  { to: '/kyc', label: 'KYC' },
  { to: '/feature-flags', label: 'Feature flags' },
  { to: '/audit', label: 'Audit' },
];

export function Shell() {
  const session = useSession();
  const queryClient = useQueryClient();

  if (session.status === 'loading') {
    return <div className="state fullscreen">Checking session…</div>;
  }
  if (session.status === 'error') {
    return (
      <div className="signin">
        <Alert kind="error">Could not reach the API: {session.errorMessage}</Alert>
      </div>
    );
  }
  if (session.status === 'signed-out' || !session.user) {
    return <DemoSignIn />;
  }

  const handleSignOut = async () => {
    await session.signOut();
    queryClient.clear();
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          Fintech Demo Console
          <small>Internal operations</small>
        </div>
        <nav className="nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="identity-card" data-testid="identity-card">
          <div className="muted identity-label">DEMO IDENTITY</div>
          <div className="name" data-testid="identity-name">{session.user.displayName}</div>
          <div className="role" data-testid="identity-role">{formatRole(session.user.role)}</div>
          <button type="button" className="btn small" onClick={() => void handleSignOut()} data-testid="sign-out">
            Switch identity
          </button>
        </div>
      </aside>
      <div className="main">
        <div className="demo-notice" data-testid="demo-notice">Synthetic data · Demo identity · No live transactions</div>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
