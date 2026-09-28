import { useState } from 'react';
import type { Decision, PrivilegedActionInput } from '@fintech-demo/contracts';
import { ActionDialog } from './ActionDialog.js';
import { Alert } from './Alert.js';

interface DecisionButtonsProps {
  entityLabel: string;
  isPending: boolean;
  canDecide: boolean;
  onDecide: (decision: Decision, input: PrivilegedActionInput) => Promise<void>;
}

/** Approve / reject controls shared by refunds and KYC. Permission is a hint here; the API decides. */
export function DecisionButtons({ entityLabel, isPending, canDecide, onDecide }: DecisionButtonsProps) {
  const [open, setOpen] = useState<Decision | null>(null);

  if (!isPending) {
    return null;
  }
  if (!canDecide) {
    return (
      <Alert kind="info" testId="decision-denied">
        Your role can view this record but cannot record a decision.
      </Alert>
    );
  }
  return (
    <>
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={() => { setOpen('APPROVED'); }} data-testid="approve-button">
          Approve
        </button>
        <button type="button" className="btn danger" onClick={() => { setOpen('REJECTED'); }} data-testid="reject-button">
          Reject
        </button>
      </div>
      {open ? (
        <ActionDialog
          title={open === 'APPROVED' ? `Approve ${entityLabel}` : `Reject ${entityLabel}`}
          description="This records a simulated decision and an audit event. No external system is called."
          confirmLabel={open === 'APPROVED' ? 'Record approval' : 'Record rejection'}
          tone={open === 'APPROVED' ? 'primary' : 'danger'}
          onConfirm={(input) => onDecide(open, input)}
          onClose={() => { setOpen(null); }}
        />
      ) : null}
    </>
  );
}
