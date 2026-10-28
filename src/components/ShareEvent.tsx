import { useEffect, useRef, useState } from 'react';
import { eventApi } from '../api/endpoints';
import type { Event } from '../api/types';
import { eventPoster } from '../utils/eventPoster';
import { Button } from './Button';
import { FormDialog } from './FormDialog';

/** A published event can be shared two ways: copy its link, or make a small poster with a QR code to save. */
export function ShareEvent({ event }: { event: Event }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [poster, setPoster] = useState<{ url: string; kb: number; blob: Blob } | null>(null);
  const [busy, setBusy] = useState(false);
  // The tracked short link (/s/code); the plain event address is the fallback if the API cannot give one.
  const plainLink = `${window.location.origin}/events/${event.id}`;
  const [link, setLink] = useState(plainLink);
  const linkPromise = useRef<Promise<string> | null>(null);
  function trackedLink(): Promise<string> {
    linkPromise.current ??= eventApi
      .shareLink(event.id)
      .then((l) => {
        const url = window.location.origin + l.path;
        setLink(url);
        return url;
      })
      .catch(() => plainLink);
    return linkPromise.current;
  }

  /** Pressing Share is counted at once, even if the person closes the window without sharing. */
  function openWindow() {
    setOpen(true);
    void eventApi.recordShareClick(event.id).catch(() => {});
    void trackedLink();
  }

  // Free the picture's memory when it is replaced or the window is gone.
  useEffect(() => () => { if (poster) URL.revokeObjectURL(poster.url); }, [poster]);

  function close() {
    setOpen(false);
    setMessage(null);
    setPoster(null);
  }

  async function copy() {
    try {
      void eventApi.recordShareClick(event.id, 'COPY_LINK').catch(() => {});
      await navigator.clipboard.writeText(await trackedLink());
      setMessage('Link copied to clipboard. Paste it anywhere to share this event.');
    } catch {
      setMessage('Could not copy automatically. Select the link above and copy it.');
    }
  }

  /** Puts the poster on the clipboard. Browsers only take PNG there, so the small JPEG is redrawn as one for the copy. */
  async function copyImage() {
    if (!poster) return;
    try {
      const bitmap = await createImageBitmap(poster.blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
      const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      setMessage('Image copied to clipboard. Paste it into a chat or a post.');
    } catch {
      setMessage("Your browser couldn't copy the image. Use Save image instead.");
    }
  }

  async function makePoster() {
    setBusy(true);
    setMessage(null);
    try {
      void eventApi.recordShareClick(event.id, 'QR_GENERATE').catch(() => {});
      // The QR carries ?src=qr so a scan is told apart from a pasted link (only the tracked short link can say so).
      const url = await trackedLink();
      const blob = await eventPoster(event, url.includes('/s/') ? `${url}?src=qr` : url);
      setPoster({ url: URL.createObjectURL(blob), kb: Math.max(1, Math.round(blob.size / 1024)), blob });
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
        <button type="button" className="btn btn-cta share-button" onClick={openWindow}>
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
            {message && (
              <p className="share-message" role="status">
                {message}
              </p>
            )}
            <div className="modal-actions">
              <Button onClick={() => { setPoster(null); setMessage(null); }}>Back</Button>
              <Button onClick={() => void copyImage()}>Copy image</Button>
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
