import { useState } from 'react';
import { FormActions } from './Button';
import type { FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { disputeApi } from '../api/endpoints';
import type { UUID } from '../api/types';
import { formatDateTime } from '../utils/format';
import { FormDialog } from './FormDialog';
import { ErrorBox } from './ui';

/** "Report a problem" with an order: the customer says what went wrong; an admin reviews it (Disputes tab). */
export function ReportProblemDialog({
  orderId,
  until,
  open,
  onClose,
  onReported,
}: {
  orderId: UUID;
  /** When the event starts: disputes can only be made before it. */
  until?: string;
  open: boolean;
  onClose: () => void;
  onReported: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!reason.trim()) return setError('Tell us what went wrong.');
    setBusy(true);
    try {
      await disputeApi.create({ orderId, reason: reason.trim() });
      setReason('');
      onReported();
    } catch (e2) {
      setError(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog open={open} title="Report a problem" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="small muted">Tell us what went wrong with this order. We will review it and let you know the outcome.</p>
        {until && (
          <p className="small muted">
            You can report an issue with this order until <strong>{formatDateTime(until)}</strong>, because disputes can only be made before the event.
          </p>
        )}
        <label>
          What happened?
          <textarea rows={5} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <ErrorBox message={error} />
        <FormActions onCancel={onClose} busy={busy} busyLabel="Sending…" submitLabel="Send report" />
      </form>
    </FormDialog>
  );
}
