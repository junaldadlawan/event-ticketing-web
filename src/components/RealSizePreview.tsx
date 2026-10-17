import { useEffect, useRef, useState } from 'react';
import type { TicketSize } from './TicketCanvas';

/** Ticket pixels per printed inch (same as the size units). */
const PRINT_DPI = 300;
/** A bank card (ISO/IEC 7810 ID-1): something everyone has to check the scale with. */
const CARD_MM = { width: 85.6, height: 53.98 };
const SCREEN_KEY = 'et.designer.screenInches';

function readScreenInches(): number | null {
  try {
    const n = Number(localStorage.getItem(SCREEN_KEY));
    return Number.isFinite(n) && n >= 5 && n <= 100 ? n : null;
  } catch {
    return null;
  }
}

/**
 * The screen's resolution in real (device) pixels. The browser knows this,
 * but not how big the screen physically is - that comes from the organizer.
 */
function screenPixels() {
  const dpr = window.devicePixelRatio || 1;
  return { width: Math.round(screen.width * dpr), height: Math.round(screen.height * dpr), dpr };
}

/**
 * CSS pixels per real inch on this screen: from its resolution and diagonal
 * size when known, otherwise the web's nominal 96 (often a little off).
 */
function cssPxPerInch(diagonalInches: number | null) {
  const px = screenPixels();
  if (!diagonalInches) return 96;
  const devicePpi = Math.hypot(px.width, px.height) / diagonalInches;
  return devicePpi / px.dpr;
}

/**
 * The design shown at its printed size (300 DPI) on this screen, with a bank
 * card outline at the same scale to check against a real card.
 */
export function RealSizePreview({
  open,
  size,
  render,
  onClose,
}: {
  open: boolean;
  size: TicketSize;
  /** Makes the picture of the design (the PNG export). */
  render: () => Promise<Blob>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [inches, setInches] = useState<number | null>(readScreenInches);
  const [draft, setDraft] = useState(inches ? String(inches) : '');

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  // A fresh picture each time it opens.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    let made: string | null = null;
    setFailed(false);
    render()
      .then((blob) => {
        if (!alive) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
      setUrl(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function applyInches(text: string) {
    setDraft(text);
    const n = Number(text);
    if (text.trim() === '') {
      setInches(null);
      try {
        localStorage.removeItem(SCREEN_KEY);
      } catch {
        /* storage unavailable: just not remembered */
      }
    } else if (Number.isFinite(n) && n >= 5 && n <= 100) {
      setInches(n);
      try {
        localStorage.setItem(SCREEN_KEY, String(n));
      } catch {
        /* storage unavailable: just not remembered */
      }
    }
  }

  const perInch = cssPxPerInch(inches);
  const widthIn = size.width / PRINT_DPI;
  const heightIn = size.height / PRINT_DPI;
  const px = screenPixels();

  return (
    <dialog
      ref={dialog}
      className="modal real-size-modal"
      aria-labelledby="real-size-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {open && (
        <div className="real-size">
          <div className="real-size-head">
            <h2 id="real-size-title" className="modal-title-plain">
              Real size
            </h2>
            <span className="muted small">
              {widthIn.toFixed(2)} × {heightIn.toFixed(2)} in · {(widthIn * 2.54).toFixed(1)} × {(heightIn * 2.54).toFixed(1)} cm
              (at {PRINT_DPI} px per inch)
            </span>
            <span className="bar-spacer" />
            <button type="button" className="btn btn-sm" onClick={onClose} autoFocus>
              Close
            </button>
          </div>

          <div className="real-size-screen small">
            <label>
              Screen size
              <input
                type="number"
                inputMode="decimal"
                min={5}
                max={100}
                step={0.1}
                placeholder="e.g. 15.6"
                aria-label="Screen size, diagonal in inches"
                value={draft}
                onChange={(e) => applyInches(e.target.value)}
              />
              in (diagonal)
            </label>
            <span className="muted">
              Resolution {px.width}×{px.height} px
              {inches ? ` · ${Math.round(perInch * px.dpr)} pixels per inch` : ' · enter your screen size for an exact scale'}
            </span>
          </div>

          <div className="real-size-stage">
            {failed ? (
              <p className="muted small">Couldn’t draw the ticket.</p>
            ) : url ? (
              <img
                src={url}
                alt="The ticket at its printed size"
                style={{ width: widthIn * perInch, height: heightIn * perInch }}
              />
            ) : (
              <p className="muted small">Drawing…</p>
            )}
            <div
              className="real-size-card"
              style={{ width: (CARD_MM.width / 25.4) * perInch, height: (CARD_MM.height / 25.4) * perInch }}
              title="A bank card at the same scale - hold a real one up to check"
            >
              Bank card
            </div>
          </div>
          <p className="muted small">
            Hold a bank card against the outline: if they match, the ticket is shown at the size it prints. If not, check the
            screen size and that the browser zoom is 100%.
          </p>
        </div>
      )}
    </dialog>
  );
}
