import { useEffect, useRef, useState } from 'react';

// How long the closing fade runs (matches .modal.is-closing in index.css).
const CLOSE_MS = 250;

/**
 * Opens a native <dialog> as a modal when `open` turns true, and on false lets it fade out before closing it.
 * `rendered` stays true until then, so the window keeps its content while it fades instead of going blank.
 */
export function useAnimatedDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  const [rendered, setRendered] = useState(open);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      setRendered(true);
      d.classList.remove('is-closing');
      if (!d.open) d.showModal();
      return;
    }
    if (!d.open || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      d.close();
      setRendered(false);
      return;
    }
    d.classList.add('is-closing');
    const t = window.setTimeout(() => {
      d.classList.remove('is-closing');
      d.close();
      setRendered(false);
    }, CLOSE_MS);
    // Opened again while fading: stop the close.
    return () => window.clearTimeout(t);
  }, [open]);
  return { ref, rendered: open || rendered };
}
