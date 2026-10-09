import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/** A native <dialog> window with a title; `children` is the form (it should include its own buttons). */
export function FormDialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
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
      className="modal modal-wide"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault(); // Escape closes it
        onClose();
      }}
    >
      {open && (
        <>
          <div className="modal-head">
            <h2>{title}</h2>
          </div>
          {children}
        </>
      )}
    </dialog>
  );
}
