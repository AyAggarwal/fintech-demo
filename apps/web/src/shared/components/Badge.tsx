export type BadgeTone = 'neutral' | 'success' | 'danger' | 'warning' | 'accent';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: string }) {
  return <span className={`badge ${tone === 'neutral' ? '' : tone}`}>{children}</span>;
}

const STATUS_TONES: Record<string, BadgeTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',
};

export function StatusBadge({ value }: { value: string }) {
  return <Badge tone={STATUS_TONES[value] ?? 'neutral'}>{value}</Badge>;
}
