import { createContext, useContext } from 'react';
import type { CurrentUser, DemoIdentityKey, Permission } from '@fintech-demo/contracts';

export type SessionStatus = 'loading' | 'signed-out' | 'signed-in' | 'error';

export interface SessionContextValue {
  status: SessionStatus;
  user: CurrentUser | null;
  errorMessage: string | null;
  signIn: (identity: DemoIdentityKey) => Promise<void>;
  signOut: () => Promise<void>;
  /** Server-resolved permissions; UI hints only. The API re-checks every mutation. */
  hasPermission: (permission: Permission) => boolean;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return value;
}
