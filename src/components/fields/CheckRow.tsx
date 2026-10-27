import type { InputHTMLAttributes, ReactNode } from 'react';
import { Checkbox } from './Checkbox';

/** A checkbox with its text, the whole row toggling it. */
export function CheckRow({ children, ...input }: { children: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'>) {
  return (
    <label className="check-row">
      <Checkbox {...input} />
      <span>{children}</span>
    </label>
  );
}
