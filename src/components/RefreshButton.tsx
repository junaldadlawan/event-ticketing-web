import { RefreshIcon } from './DesignerIcons';

/** A small reload icon for a section's header; it spins and is disabled while that section is loading. */
export function RefreshButton({ onClick, busy, label = 'Reload' }: { onClick: () => void; busy: boolean; label?: string }) {
  return (
    <button type="button" className={`icon-button refresh-button${busy ? ' is-spinning' : ''}`} title={label} aria-label={label} disabled={busy} onClick={onClick}>
      <RefreshIcon />
    </button>
  );
}
