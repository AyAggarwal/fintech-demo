import type { ReactNode } from 'react';

export type AlertKind = 'error' | 'success' | 'info' | 'warning';

export function Alert({ kind, children, testId }: { kind: AlertKind; children: ReactNode; testId?: string }) {
  return (
    <div className={`alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'} data-testid={testId}>
      {children}
    </div>
  );
}
