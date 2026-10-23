import type { InputHTMLAttributes, ReactNode } from 'react';

/** A checkbox with its text, the whole row toggling it. */
export function CheckRow({ children, ...input }: { children: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'>) {
  return (
    <label className="check-row">
      <input {...input} type="checkbox" />
      <span>{children}</span>
    </label>
  );
}
