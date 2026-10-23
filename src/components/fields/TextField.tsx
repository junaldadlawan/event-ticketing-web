import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Field } from './Field';

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  optional?: boolean;
  error?: ReactNode;
}

/** A single-line text box (text, email, tel, url, password, search, number...) with the shared label, hint and error. */
export function TextField({ label, hint, optional, error, ...input }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} optional={optional} required={input.required} error={error}>
      <input {...input} aria-invalid={error ? true : undefined} />
    </Field>
  );
}

/** A date box: the browser's date picker, with the shared label, hint and error. */
export function DateField({ label, hint, optional, error, ...input }: FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <TextField label={label} hint={hint} optional={optional} error={error} {...input} type="date" />;
}

/** A multi-line text box with the shared label, hint and error. */
export function TextAreaField({ label, hint, optional, error, ...area }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} hint={hint} optional={optional} required={area.required} error={error}>
      <textarea {...area} aria-invalid={error ? true : undefined} />
    </Field>
  );
}

/** A dropdown with the shared label, hint and error; the options are its children. */
export function SelectField({
  label,
  hint,
  optional,
  error,
  children,
  ...select
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} hint={hint} optional={optional} required={select.required} error={error}>
      <select {...select} aria-invalid={error ? true : undefined}>
        {children}
      </select>
    </Field>
  );
}
