import { useState } from 'react';
import type { ReactNode } from 'react';
import type { PrivilegedActionInput } from '@fintech-demo/contracts';
import { describeError } from '../api/index.js';
import { Alert } from './Alert.js';

export interface ActionDialogProps {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  onConfirm: (input: PrivilegedActionInput) => Promise<void>;
  onClose: () => void;
}

/**
 * Shared confirmation form for privileged actions. The optional reason is the single place
 * to extend when action policy changes (e.g. requiring a reason) — the API enforces the rule.
 */
export function ActionDialog({ title, description, confirmLabel, tone = 'primary', onConfirm, onClose }: ActionDialogProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const trimmed = reason.trim();
      await onConfirm(trimmed ? { reason: trimmed } : {});
      onClose();
    } catch (err) {
      setError(describeError(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <form className="dialog panel-body" role="dialog" aria-modal="true" aria-labelledby="action-dialog-title" onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}>
        <h2 id="action-dialog-title">{title}</h2>
        <p>{description}</p>
        <label className="field">
          Reason (optional)
          <textarea
            name="reason"
            value={reason}
            maxLength={500}
            onChange={(event) => { setReason(event.target.value); }}
            placeholder="Recorded on the audit event"
          />
        </label>
        {error ? <Alert kind="error" testId="action-error">{error}</Alert> : null}
        <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className={`btn ${tone}`} disabled={submitting} data-testid="action-confirm">
            {submitting ? 'Submitting…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
