import { useEffect, useRef, useState } from 'react';
import { userQrDataUrl } from '../utils/userQr';

/**
 * "My QR": the user's transfer QR code in a dialog. Someone who wants to send them a ticket uploads this
 * picture on the transfer form instead of typing the user ID. Shows the code, with a Download button.
 */
export function MyQrDialog({
  open,
  onClose,
  userId,
  name,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  name: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    userQrDataUrl(userId).then((url) => alive && setSrc(url)).catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [open, userId]);

  return (
    <dialog
      ref={dialog}
      className="modal my-qr-dialog"
      aria-labelledby="my-qr-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === dialog.current && onClose()}
    >
      {open && (
        <div className="form my-qr-dialog-body">
          <h2 id="my-qr-title" className="modal-title-plain">
            My QR
          </h2>
          <p className="muted small">Share this so someone can send you a ticket without typing your ID.</p>
          {src ? (
            <img src={src} alt={`Transfer QR code for ${name}`} width={220} height={220} />
          ) : (
            <p className="muted small">Making your QR code…</p>
          )}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
            {src && (
              <a className="btn btn-primary" href={src} download="my-ticket-transfer-qr.png">
                Download
              </a>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
