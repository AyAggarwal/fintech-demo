import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryKey, UseMutationResult } from '@tanstack/react-query';
import { auditQueryKeys } from './api.js';

interface AuditedMutationOptions<TData, TVariables> {
  featureKey: QueryKey;
  mutationFn: (variables: TVariables) => Promise<TData>;
  onResult?: (data: TData) => void;
}

/**
 * Runs a privileged mutation and, on success, refreshes both the feature's cache and the audit cache,
 * since the API commits the change and its audit event together.
 */
export function useAuditedMutation<TData, TVariables>({
  featureKey,
  mutationFn,
  onResult,
}: AuditedMutationOptions<TData, TVariables>): UseMutationResult<TData, Error, TVariables> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (data) => {
      onResult?.(data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: featureKey }),
        queryClient.invalidateQueries({ queryKey: auditQueryKeys.all }),
      ]);
    },
  });
}
