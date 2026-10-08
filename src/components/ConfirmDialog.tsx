import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * Simple yes/no confirmation in a native <dialog> (focus stays inside,
 * Escape = cancel). The cancel button is focused so Enter is the safe choice.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      {open && (
        <div className="form">
          <h2 id="confirm-title" className="modal-title-plain">
            {title}
          </h2>
          <div className="small muted">{children}</div>
          <div className="modal-actions">
            <button type="button" className="btn" autoFocus onClick={onCancel}>
              {cancelLabel}
            </button>
            <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
