import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/** Icon button that opens a small panel below it; closes on outside click or Escape. */
export function Popover({
  label,
  icon,
  text,
  disabled,
  pressed,
  floating = false,
  compact = false,
  children,
}: {
  label: string;
  icon: ReactNode;
  /** A short visible name beside the icon, so the button says what it does without hovering. */
  text?: string;
  /** Shrink the panel to its content (a short row of buttons) instead of the usual menu width. */
  compact?: boolean;
  disabled?: boolean;
  /** Show the button as "on" (e.g. the grid is visible). */
  pressed?: boolean;
  /**
   * Place the panel on the page (fixed) instead of inside the button's box -
   * for buttons in a bar that clips its contents (the selection bar scrolls).
   */
  floating?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number; centre: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    }
    // A floating panel is placed on the page: keep it under its button when
    // the page or the bar scrolls (clicking in a scrolling bar can scroll it).
    function onMove() {
      if (floating) place();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, floating]);

  function place() {
    if (!button.current) return;
    const r = button.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right), centre: r.left + r.width / 2 });
  }

  function toggle() {
    if (!open && floating) place();
    setOpen((o) => !o);
  }

  return (
    <div className="popover" ref={root}>
      <button
        ref={button}
        type="button"
        className={`icon-button${pressed !== undefined ? ' toggle-button' : ''}${text ? ' has-text' : ''}`}
        title={label}
        aria-label={label}
        aria-expanded={open}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={toggle}
      >
        {icon}
        {text && <span>{text}</span>}
      </button>
      {open && (
        <div
          className={`popover-panel${compact ? ' popover-panel-compact' : ''}`}
          role="dialog"
          aria-label={label}
          style={
            floating && pos
              ? compact
                ? { position: 'fixed', top: pos.top, left: pos.centre, right: 'auto', transform: 'translateX(-50%)' }
                : { position: 'fixed', top: pos.top, right: pos.right }
              : undefined
          }
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
