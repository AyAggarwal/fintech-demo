import type { Role } from '@fintech-demo/contracts';

const ROLE_LABELS: Record<Role, string> = {
  VIEWER: 'Viewer',
  OPS_ANALYST: 'Operations analyst',
  ADMIN: 'Administrator',
};

export function formatRole(role: Role): string {
  return ROLE_LABELS[role];
}

export function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountCents / 100);
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

export function formatEnumLabel(value: string): string {
  return value.toLowerCase().replace(/[_.]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
