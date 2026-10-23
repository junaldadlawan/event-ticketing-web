import { useEffect, useState } from 'react';
import type { Event } from '../api/types';
import { eventPoster } from '../utils/eventPoster';
import { Button } from './Button';
import { FormDialog } from './FormDialog';

/** A published event can be shared two ways: copy its link, or make a small poster with a QR code to save. */
export function ShareEvent({ event }: { event: Event }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [poster, setPoster] = useState<{ url: string; kb: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const link = `${window.location.origin}/events/${event.id}`;

  // Free the picture's memory when it is replaced or the window is gone.
  useEffect(() => () => { if (poster) URL.revokeObjectURL(poster.url); }, [poster]);

  function close() {
    setOpen(false);
    setMessage(null);
    setPoster(null);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setMessage('Link copied to clipboard. Paste it anywhere to share this event.');
    } catch {
      setMessage('Could not copy automatically. Select the link above and copy it.');
    }
  }

  async function makePoster() {
    setBusy(true);
    setMessage(null);
    try {
      const blob = await eventPoster(event, link);
      setPoster({ url: URL.createObjectURL(blob), kb: Math.max(1, Math.round(blob.size / 1024)) });
    } catch {
      setMessage('Could not make the poster. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="share-invite">
        <span className="share-invite-text">Who would love this? Bring them along.</span>
        <button type="button" className="btn btn-cta share-button" onClick={() => setOpen(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
          </svg>
          Share
        </button>
      </div>
      <FormDialog open={open} title="Bring someone along" onClose={close}>
        {poster ? (
          <div className="share-poster">
            <img src={poster.url} alt={`Poster for ${event.title} with a QR code`} />
            <p className="muted small">Small image, about {poster.kb} KB. Scanning the code opens this event.</p>
            <div className="modal-actions">
              <Button onClick={() => setPoster(null)}>Back</Button>
              <a className="btn btn-cta" href={poster.url} download={`${event.title.replace(/[^\w]+/g, '-').toLowerCase()}-poster.jpg`}>
                Save image
              </a>
            </div>
          </div>
        ) : (
          <div className="share-choices">
            <button type="button" className="share-choice" onClick={() => void copy()}>
              <strong>Copy link</strong>
              <span className="share-link">{link}</span>
            </button>
            <button type="button" className="share-choice" disabled={busy} onClick={() => void makePoster()}>
              <strong>{busy ? 'Making the poster...' : 'Generate QR poster'}</strong>
              <span className="muted">A small poster with the event details and a QR code to save or print.</span>
            </button>
            {message && (
              <p className="share-message" role="status">
                {message}
              </p>
            )}
          </div>
        )}
      </FormDialog>
    </>
  );
}
