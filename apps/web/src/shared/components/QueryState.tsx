import type { ReactNode } from 'react';
import { ApiError, describeError } from '../api/index.js';
import { Alert } from './Alert.js';

interface QueryStateProps<T> {
  isLoading: boolean;
  error: unknown;
  data: T | undefined;
  children: (data: T) => ReactNode;
  loadingMessage?: string;
}

/** Renders loading / error / permission-denied states uniformly, then defers to children with data. */
export function QueryState<T>({ isLoading, error, data, children, loadingMessage = 'Loading…' }: QueryStateProps<T>) {
  if (isLoading) {
    return <div className="state">{loadingMessage}</div>;
  }
  if (error) {
    if (error instanceof ApiError && error.isPermissionDenied) {
      return <Alert kind="warning">Permission denied: {error.message}</Alert>;
    }
    return <Alert kind="error">{describeError(error)}</Alert>;
  }
  if (data === undefined) {
    return <div className="state">Nothing to show.</div>;
  }
  return <>{children(data)}</>;
}
