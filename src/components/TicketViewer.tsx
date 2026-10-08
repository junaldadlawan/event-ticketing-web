import { useEffect, useRef } from 'react';
import { DownloadIcon } from './DesignerIcons';

/**
 * Shows a ticket (the PNG or the PDF) in our own window with a Close button and a Download link, instead of
 * opening the bare file in a new tab with no way back. Escape or a click outside closes it.
 */
export function TicketViewer({
  url,
  format,
  title,
  onClose,
}: {
  /** An object URL of the ticket file; null = closed. */
  url: string | null;
  format: 'digital' | 'physical';
  title: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (url && !d.open) d.showModal();
    else if (!url && d.open) d.close();
  }, [url]);

  const extension = format === 'digital' ? 'png' : 'pdf';

  return (
    <dialog
      ref={dialog}
      className="modal modal-viewer"
      aria-label={`${title} ticket`}
      onCancel={(e) => {
        e.preventDefault(); // Escape closes it
        onClose();
      }}
      // A click on the dark area around the window (the dialog element itself) closes it.
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      {url && (
        <>
          <div className="viewer-bar">
            <strong>{title}</strong>
            <span className="viewer-actions">
              <a className="btn btn-sm" href={url} download={`ticket.${extension}`}>
                <DownloadIcon />
                Download
              </a>
              <button type="button" className="btn btn-sm btn-primary" autoFocus onClick={onClose}>
                Close
              </button>
            </span>
          </div>
          <div className="viewer-body">
            {format === 'digital' ? (
              <img src={url} alt={`${title} ticket`} />
            ) : (
              <iframe src={url} title={`${title} ticket (PDF)`} />
            )}
          </div>
        </>
      )}
    </dialog>
  );
}
