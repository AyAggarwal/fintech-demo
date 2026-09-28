import { useEffect, useState } from 'react';
import type { DemoIdentityKey, DemoIdentitySummary } from '@fintech-demo/contracts';
import { describeError } from '../api/index.js';
import { Alert } from '../components/index.js';
import { formatRole } from '../format.js';
import { fetchDemoIdentities } from './api.js';
import { useSession } from './session-context.js';

export function DemoSignIn() {
  const { signIn } = useSession();
  const [identities, setIdentities] = useState<DemoIdentitySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<DemoIdentityKey | null>(null);

  useEffect(() => {
    fetchDemoIdentities()
      .then(setIdentities)
      .catch((err: unknown) => {
        setError(describeError(err));
      });
  }, []);

  const handleSelect = async (identity: DemoIdentityKey) => {
    setPending(identity);
    setError(null);
    try {
      await signIn(identity);
    } catch (err) {
      setError(describeError(err));
      setPending(null);
    }
  };

  return (
    <div className="signin">
      <div className="panel">
        <div className="panel-header">
          <h2>Fintech Demo Console</h2>
          <span className="badge warning">DEMO MODE</span>
        </div>
        <div className="panel-body">
          <p className="muted">
            Choose a seeded demo identity. Sessions are resolved server-side; this screen cannot create users or roles.
          </p>
          {error ? <Alert kind="error">{error}</Alert> : null}
          {!identities && !error ? <div className="state">Loading identities…</div> : null}
          {identities ? (
            <div className="identity-list">
              {identities.map((identity) => (
                <button
                  key={identity.key}
                  type="button"
                  className="identity-option"
                  disabled={pending !== null}
                  onClick={() => void handleSelect(identity.key)}
                  data-testid={`sign-in-${identity.key}`}
                >
                  <span>
                    <div>{identity.displayName}</div>
                    <div className="desc">{identity.description}</div>
                  </span>
                  <span className="badge accent">{formatRole(identity.role)}</span>
                </button>
              ))}
            </div>
          ) : null}
          <p className="muted caption">
            Synthetic data · Demo identity · No live transactions
          </p>
        </div>
      </div>
    </div>
  );
}
