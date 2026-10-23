import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

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
  return (
    <div className={`settings-layout${className ? ` ${className}` : ''}`}>
      <nav className="settings-nav" aria-label={label}>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>
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
