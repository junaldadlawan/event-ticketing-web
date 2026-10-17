import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { ErrorBox } from '../../components/ui';

/** A short form asking for the reason an admin action needs (kept as the audit trail). */
export function ReasonForm({
  intro,
  confirmLabel,
  danger = false,
  optional = false,
  onCancel,
  onSubmit,
}: {
  intro: string;
  confirmLabel: string;
  danger?: boolean;
  /** The reason may be left empty (e.g. rejecting an application). */
  optional?: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!optional && !reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
    } catch (e2) {
      setError(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <p className="small">{intro}</p>
      <label>
        Reason {optional && <span className="muted">(optional)</span>}
        <textarea
          required={!optional}
          autoFocus
          rows={3}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Kept in the moderation history"
        />
      </label>
      <ErrorBox message={error} />
      <div className="modal-actions">
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          disabled={busy || (!optional && !reason.trim())}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </form>
  );
}
