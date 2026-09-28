import type { PrivilegedActionInput } from '@fintech-demo/contracts';

/**
 * Policy for the free-text reason attached to a privileged action.
 * Today a reason is optional; blank input is stored as null.
 */
export function resolveActionReason(input: PrivilegedActionInput): string | null {
  const trimmed = input.reason?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}
