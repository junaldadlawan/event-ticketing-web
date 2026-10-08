import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { authApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { TrashIcon } from './DesignerIcons';
import { ErrorBox } from './ui';

/**
 * Confirmation before deleting an event: the user must type the event's exact
 * name and re-enter their password. Uses a native <dialog> (focus stays
 * inside, Escape closes, the page behind can't be clicked).
 *
 * Also used for cancelling an event (`kind="cancel"`), with its own wording.
 *
 * Note: this is a safeguard in the app. The API's delete and cancel endpoints
 * themselves don't ask for a password.
 */
const COPY = {
  delete: {
    title: 'Delete event',
    text: 'permanently removes',
    after: "It can't be undone.",
    keep: 'Keep event',
    confirm: 'Delete event',
    busy: 'Deleting…',
  },
  cancel: {
    title: 'Cancel event',
    text: 'cancels',
    after: 'Buyers will be affected.',
    keep: 'Keep event',
    confirm: 'Cancel event',
    busy: 'Cancelling…',
  },
} as const;

export function DeleteEventDialog({
  open,
  eventTitle,
  kind = 'delete',
  onCancel,
  onConfirmed,
}: {
  open: boolean;
  eventTitle: string;
  /** What the dialog is for: deleting the event (default) or cancelling it. */
  kind?: 'delete' | 'cancel';
  onCancel: () => void;
  /** Runs the actual delete / cancel once name + password check out. */
  onConfirmed: () => Promise<void>;
}) {
  const { user } = useAuth();
  const copy = COPY[kind];
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      setName('');
      setPassword('');
      setError(null);
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  const nameMatches = name.trim() === eventTitle.trim();
  const canSubmit = nameMatches && password.length > 0 && !busy && Boolean(user);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !user) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await authApi.verifyPassword(user.email, password);
      if (!ok) {
        setError('Incorrect password.');
        setPassword('');
        return;
      }
      await onConfirmed();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="delete-event-title"
      // Escape / backdrop close -> tell the parent (unless mid-delete).
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onCancel();
      }}
    >
      <form className="form" onSubmit={onSubmit}>
        <div className="modal-head">
          <span className="modal-icon" aria-hidden="true">
            <TrashIcon />
          </span>
          <h2 id="delete-event-title">{copy.title}</h2>
        </div>
        <p className="small">
          This {copy.text} <strong>{eventTitle}</strong>. {copy.after}
        </p>

        <label>
          <span>
            Type <strong className="modal-name">{eventTitle}</strong> to confirm
          </span>
          <input
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={name.length > 0 && !nameMatches}
          />
        </label>

        <label>
          Your password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <ErrorBox message={error} />

        <div className="modal-actions">
          <button type="button" className="btn" disabled={busy} onClick={onCancel}>
            {copy.keep}
          </button>
          <button type="submit" className="btn btn-danger" disabled={!canSubmit}>
            {busy ? copy.busy : copy.confirm}
          </button>
        </div>
      </form>
    </dialog>
  );
}
