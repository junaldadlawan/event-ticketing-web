import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export interface TabItem<T extends string> {
  key: T;
  label: ReactNode;
  count?: number;
  /** A tab that is a page of its own: a link (the open one follows the address). Left out = a button that calls `onChange`. */
  to?: string;
}

/**
 * The shared tab bar: an underline under the open tab, in the accent colour. Use it wherever a page has several tabs,
 * either as links to other pages (`to`) or as buttons that switch what the page shows (`value` and `onChange`).
 */
export function Tabs<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: TabItem<T>[];
  value?: T;
  onChange?: (key: T) => void;
}) {
  return (
    <nav className="tabs" aria-label={label}>
      {items.map((t) => {
        const inner = (
          <>
            {t.label}
            {t.count ? <span className="tab-count">{t.count}</span> : null}
          </>
        );
        return t.to ? (
          <NavLink key={t.key} to={t.to}>
            {inner}
          </NavLink>
        ) : (
          <button key={t.key} type="button" className={value === t.key ? 'active' : ''} aria-pressed={value === t.key} onClick={() => onChange?.(t.key)}>
            {inner}
          </button>
        );
      })}
    </nav>
  );
}
