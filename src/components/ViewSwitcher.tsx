import { useEffect, useRef, useState } from 'react';
import type { ViewMode } from '../auth/ViewMode';
import { CheckIcon, ChevronDownIcon } from './DesignerIcons';

const OPTIONS: { mode: ViewMode; label: string; hint: string }[] = [
  { mode: 'customer', label: 'Customer', hint: 'The app the way buyers see it' },
  { mode: 'manage', label: 'Management', hint: 'Manage events, tickets and posts' },
];

/** One button showing the current view; clicking it opens a short menu to choose Customer or Management. */
export function ViewSwitcher({ mode, onChoose }: { mode: ViewMode; onChoose: (next: ViewMode) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = OPTIONS.find((o) => o.mode === mode) ?? OPTIONS[1]!;

  return (
    <div className="popover view-switcher" ref={root}>
      <button
        type="button"
        className="view-switcher-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Viewing as ${current.label}. Change view`}
        onClick={() => setOpen((o) => !o)}
      >
        {current.label}
        <span className={`launch-chevron${open ? ' is-open' : ''}`} aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      {open && (
        <div className="popover-panel view-switcher-menu" role="menu">
          {OPTIONS.map((o) => (
            <button
              key={o.mode}
              type="button"
              role="menuitemradio"
              aria-checked={o.mode === mode}
              className="view-switcher-item"
              onClick={() => {
                setOpen(false);
                if (o.mode !== mode) onChoose(o.mode);
              }}
            >
              <span className="view-switcher-check" aria-hidden="true">
                {o.mode === mode && <CheckIcon />}
              </span>
              <span>
                <strong>{o.label}</strong>
                <small className="muted">{o.hint}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
