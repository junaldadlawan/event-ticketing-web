import type { ReactNode } from 'react';

/** A row of toggle buttons where one is chosen (a filter, a layout switch): `text` for the plain-words style, with optional counts. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  text,
}: {
  options: { value: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  text?: boolean;
}) {
  return (
    <div className={`segmented${text ? ' segmented-text' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count ? <span className="seg-count">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
