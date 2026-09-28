import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CurrentUser, DemoIdentityKey } from '@fintech-demo/contracts';
import { describeError } from '../api/index.js';
import { demoLogin, fetchSession, logout } from './api.js';
import { SessionContext } from './session-context.js';
import type { SessionContextValue, SessionStatus } from './session-context.js';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSession()
      .then((current) => {
        if (cancelled) return;
        setUser(current);
        setStatus(current ? 'signed-in' : 'signed-out');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setErrorMessage(describeError(error));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (identity: DemoIdentityKey) => {
    const current = await demoLogin(identity);
    setUser(current);
    setStatus('signed-in');
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    setUser(null);
    setStatus('signed-out');
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      user,
      errorMessage,
      signIn,
      signOut,
      hasPermission: (permission) => user?.permissions.includes(permission) ?? false,
    }),
    [status, user, errorMessage, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
