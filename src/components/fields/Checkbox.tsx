import type { InputHTMLAttributes } from 'react';

/** The app's checkbox: a rounded box in the accent colour with a drawn tick. Use it instead of a bare `<input type="checkbox">`. */
export function Checkbox({ className, ...input }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <input {...input} type="checkbox" className={className ? `checkbox ${className}` : 'checkbox'} />;
}
