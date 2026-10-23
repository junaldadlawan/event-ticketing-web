import type { ReactNode } from 'react';
import { useAnimatedDialog } from './useAnimatedDialog';

/** A native <dialog> window with a title; `children` is the form (it should include its own buttons). */
export function FormDialog({
  open,
  title,
  onClose,
  children,
  size,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 'large' for a window with a table in it. */
  size?: 'large';
}) {
  const { ref: dialog, rendered } = useAnimatedDialog(open);
  return (
    <dialog
      ref={dialog}
      className={`modal modal-wide${size === 'large' ? ' modal-large' : ''}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault(); // Escape closes it
        onClose();
      }}
    >
      {rendered && (
        <>
          <div className="modal-head">
            <h2>{title}</h2>
            <button type="button" className="modal-close" aria-label="Close" title="Close" onClick={onClose}>
              ×
            </button>
          </div>
          {children}
        </>
      )}
    </dialog>
  );
}
