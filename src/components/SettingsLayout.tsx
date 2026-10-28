import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

/** A short list of pages on the left and the chosen page on the right (Profile, Settings): the one settings layout. */
export function SettingsLayout({
  label,
  links,
  className,
  children,
}: {
  label: string;
  links: { to: string; label: ReactNode; end?: boolean }[];
  className?: string;
  children: ReactNode;
}) {
  // Moving between these pages replaces the history entry instead of adding one, so Back leaves the whole group (to the page you came
  // from) rather than stepping through the tabs you clicked. The state travels along: `from` (where you came from), and `fresh`
  // (this group was the first page of the visit, so there is nothing in the app to go back to).
  const location = useLocation();
  const state = location.state as { from?: string; fresh?: boolean } | null;
  const carried = { ...state, ...(location.key === 'default' || state?.fresh ? { fresh: true } : {}) };
  return (
    <div className={`settings-layout${className ? ` ${className}` : ''}`}>
      <nav className="settings-nav" aria-label={label}>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} replace state={carried}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="settings-panel">{children}</div>
    </div>
  );
}

/** One line of a settings list: what it is, its value, and an optional button to change it. */
export function SettingRow({ label, children, action }: { label: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="setting-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
      {action}
    </div>
  );
}
